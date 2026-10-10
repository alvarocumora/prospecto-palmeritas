import { geoColors } from "@/lib/geospatial/visualTokens";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Layer, GeoJSON as LeafletGeoJSON, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import {
  Map as MapIcon,
  Satellite,
  Radio,
  Mountain,
  FlaskConical,
  Target,
  Maximize,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { buildGeophysicsOverlays } from "@/components/map/geophysicsOverlays";
import {
  buildGeophysicsLayer,
  buildGeophysicsSurfaceLayer,
  buildAnomalySurfaceLayer,
} from "@/components/map/geophysicsLayers";
import { buildFieldGeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import { buildAnomalySurface, anomalyIntensityColor } from "@/lib/geoscience/anomalySurface";
import type { GeophysicsData } from "@/types/geophysics";
import { EvidenceBadge, type Evidence } from "@/components/ui-system";
import { resolveGeoLayer } from "@/lib/geospatial/layerRegistry";
import { useGeoLayerPreferences } from "@/hooks/useGeoLayerPreferences";
import { applyLayerOpacity } from "@/lib/geospatial/leafletOpacity";
import { proposedTraceEnd, TERRAIN_METERS_PER_DEGREE } from "@/lib/geospatial/terrainCoordinates";

/**
 * Visor geoespacial maestro, genérico por proyecto. Reemplaza los mapas apilados
 * (evidencia + pertenencias + targets) por UNA sola instancia con capas
 * conmutables e inspector lateral.
 *
 * GUARDAS DE HONESTIDAD (no negociables):
 *  - Procedencia visible por entidad: Certificado (ensaye) / Derivado (anomalía) /
 *    Conceptual (sondaje). Nunca se presenta lo derivado/conceptual como medido.
 *  - Los halos satelitales son REPRESENTACIÓN INTERPRETATIVA de la firma espectral,
 *    NO una extensión de alteración medida en terreno. El radio no es un dato.
 *  - Distinción jurídica: dentro de tenencia (línea continua) vs contexto regional
 *    (línea punteada + aviso "verificar tenencia").
 */

export type AssayPoint = {
  code: string;
  name?: string;
  lat: number;
  lng: number;
  cuTotalPct?: number;
  cuSolublePct?: number;
  auGpt?: number;
  agPpm?: number;
  certified?: boolean;
  lab?: string;
  reportId?: string;
  reportDate?: string;
};

export type MasterViewerProps = {
  projectName: string;
  onMapReady?: (map: LeafletMap) => void;
  basemapOverride?: "satellite" | "topo" | null;
  /** Selector estable para capturar el mapa real en los PDF (data-report-map). */
  reportMapId?: string;
  center: { lat: number; lng: number };
  concessions?: FeatureCollection | null;
  anomalies?: FeatureCollection | null;
  drillGrid?: FeatureCollection | null;
  pedimentos?: FeatureCollection | null;
  assays?: AssayPoint[];
  coverage?: { typicalPct?: number; bestcasePct?: number; conclusive?: boolean } | null;
  geophysics?: GeophysicsData | null;
  // Capas de inteligencia de catastro (data oficial SERNAGEOMIN, ArcGIS Online):
  franjas?: FeatureCollection | null; // franjas metalogénicas (contexto de sistema mineral)
  yacimientos?: FeatureCollection | null; // depósitos conocidos / minerales críticos (Merge_RR)
  geoquimica?: FeatureCollection | null; // muestras de sedimento (multi-elemento medido)
  estructuras?: FeatureCollection | null; // vetas con rumbo/manteo medido en terreno
  pedimentosPendientes?: FeatureCollection | null; // pedimentos del titular no publicados aún en catastro oficial
  mojones?: FeatureCollection | null; // hitos de mensura (HM) reportados por el titular
  height?: number;
  enableLayerTools?: boolean;
  anomalyIntensityDisabledReason?: string;
  spectralFootprintsOnly?: boolean;
  coordinateNotice?: string;
  contextLayers?: Array<{
    id: string;
    label: string;
    evidence: string;
    evidenceForFeature?: (properties: Record<string, unknown>) => string;
    caution?: string | null;
    features: FeatureCollection;
    color?: string | ((properties: Record<string, unknown>) => string);
  }>;
};

const EMPTY_ASSAYS: AssayPoint[] = [];

const ALTERATION_COLOR: Record<string, string> = {
  CLAY_MINERALS: geoColors.clay, // Al-OH / fílica → cian
  HYDROTHERMAL_ALTERATION: geoColors.hydrothermal, // hidrotermal mixta → magenta
  IRON_OXIDE: geoColors.ironOxide, // óxidos / gossan → ámbar
  STRUCTURAL_LINEAMENTS: geoColors.lineament, // lineamientos → dorado
};
const ALTERATION_LABEL: Record<string, string> = {
  CLAY_MINERALS: "Al-OH / arcillas (fílica)",
  HYDROTHERMAL_ALTERATION: "Alteración hidrotermal",
  IRON_OXIDE: "Óxidos de hierro / gossan",
  STRUCTURAL_LINEAMENTS: "Lineamiento estructural",
};

type LayerKey =
  | "tenencia"
  | "pedimentosPendientes"
  | "mojones"
  | "halos"
  | "halosIntensidad"
  | "magneticaRegional"
  | "gravedadRegional"
  | "geofisicaProyecto"
  | "magSurfaceProject"
  | "ipChargeSurfaceProject"
  | "ipResSurfaceProject"
  | "relieve"
  | "franjas"
  | "yacimientos"
  | "geoquimica"
  | "estructuras"
  | "sondajes"
  | "ensayes"
  | "pedimentos";
type Selected = { kind: LayerKey; props: Record<string, unknown> } | null;

const LAYER_SECTIONS: ReadonlyArray<{
  title: string;
  icon: LucideIcon;
  note?: string;
  defaultOpen?: boolean;
  layers: ReadonlyArray<[LayerKey, string]>;
}> = [
  {
    title: "Territorio",
    icon: MapIcon,
    defaultOpen: true,
    layers: [
      ["tenencia", "Catastro SERNAGEOMIN"],
      ["pedimentosPendientes", "Pedimentos sin publicar (KML titular)"],
      ["mojones", "Hitos de mensura (HM)"],
      ["relieve", "Relieve / hillshade"],
    ],
  },
  {
    title: "Teledetección",
    icon: Satellite,
    defaultOpen: true,
    note: "Derivado de sensores remotos; requiere validación en terreno.",
    layers: [
      ["halos", "Halos espectrales · Sentinel-2"],
      ["halosIntensidad", "Mapa de intensidad · IDW"],
    ],
  },
  {
    title: "Geofísica",
    icon: Radio,
    note: "Regional = contexto. Superficies de proyecto = IDW derivado de estaciones CAMPO; no son inversión.",
    layers: [
      ["magneticaRegional", "Anomalía magnética · EMAG2 v3"],
      ["gravedadRegional", "Anomalía Bouguer · WGM2012"],
      ["geofisicaProyecto", "Estaciones y líneas · proyecto"],
      ["magSurfaceProject", "Halo magnético residual · CAMPO → IDW"],
      ["ipChargeSurfaceProject", "Halo IP cargabilidad · CAMPO → IDW"],
      ["ipResSurfaceProject", "Halo IP resistividad · CAMPO → IDW"],
    ],
  },
  {
    title: "Distrito / metalogenia",
    icon: Mountain,
    note: "Contexto oficial SERNAGEOMIN: franja metalogénica y depósitos conocidos cercanos.",
    layers: [
      ["franjas", "Franjas metalogénicas"],
      ["yacimientos", "Yacimientos / minerales críticos"],
    ],
  },
  {
    title: "Geoquímica",
    icon: FlaskConical,
    note: "Sedimento fluvial medido (SERNAGEOMIN). Dispersión regional, no ley in situ.",
    layers: [["geoquimica", "Geoquímica de sedimentos · Cu"]],
  },
  {
    title: "Exploración",
    icon: Target,
    defaultOpen: true,
    layers: [
      ["ensayes", "Ensayes certificados"],
      ["estructuras", "Vetas · rumbo/manteo de terreno"],
      ["sondajes", "Sondajes propuestos"],
      ["pedimentos", "Pedimentos propuestos"],
    ],
  },
];

// Mismos stops que `anomalyIntensityColor` (blue→cyan→green→yellow→magenta),
// expresados como CSS para la leyenda de gradiente.
const ANOMALY_GRADIENT_STOPS: ReadonlyArray<[number, string]> = [
  [0, anomalyIntensityColor(0)],
  [0.3, anomalyIntensityColor(0.3)],
  [0.55, anomalyIntensityColor(0.55)],
  [0.75, anomalyIntensityColor(0.75)],
  [1, anomalyIntensityColor(1)],
];

type ProvKind = "certificado" | "medido" | "declarado" | "derivado" | "conceptual" | "contexto";
const PROV: Record<ProvKind, { label: string; bg: string }> = {
  medido: { label: "MEDIDO EN TERRENO", bg: geoColors.measured },
  declarado: { label: "OBSERVACIÓN DOCUMENTAL", bg: geoColors.declared },
  certificado: { label: "CERTIFICADO", bg: geoColors.certified },
  derivado: { label: "DERIVADO", bg: geoColors.measured },
  conceptual: { label: "PROPUESTO / CONCEPTUAL", bg: geoColors.conceptual },
  contexto: { label: "CONTEXTO — verificar tenencia", bg: geoColors.context },
};

// Badge de evidencia + escala/resolución por capa: hace evidente qué está viendo
// el usuario y evita que un raster regional se confunda con geofísica de detalle.
// El badge vive en el design system (@/components/ui-system).
function canonicalLayerMeta(key: LayerKey): { evidence: Evidence; scale: string } {
  const definition = resolveGeoLayer(key);
  if (!definition) {
    throw new Error(`Missing canonical geospatial layer mapping for ${key}`);
  }
  return {
    evidence: definition.evidence,
    scale: definition.scaleLabel,
  };
}

const LAYER_META: Record<LayerKey, { evidence: Evidence; scale: string }> = {
  tenencia: canonicalLayerMeta("tenencia"),
  pedimentosPendientes: canonicalLayerMeta("pedimentosPendientes"),
  mojones: canonicalLayerMeta("mojones"),
  halos: canonicalLayerMeta("halos"),
  halosIntensidad: canonicalLayerMeta("halosIntensidad"),
  magneticaRegional: canonicalLayerMeta("magneticaRegional"),
  gravedadRegional: canonicalLayerMeta("gravedadRegional"),
  geofisicaProyecto: canonicalLayerMeta("geofisicaProyecto"),
  magSurfaceProject: canonicalLayerMeta("magSurfaceProject"),
  ipChargeSurfaceProject: canonicalLayerMeta("ipChargeSurfaceProject"),
  ipResSurfaceProject: canonicalLayerMeta("ipResSurfaceProject"),
  relieve: canonicalLayerMeta("relieve"),
  franjas: canonicalLayerMeta("franjas"),
  yacimientos: canonicalLayerMeta("yacimientos"),
  geoquimica: canonicalLayerMeta("geoquimica"),
  estructuras: canonicalLayerMeta("estructuras"),
  sondajes: canonicalLayerMeta("sondajes"),
  ensayes: canonicalLayerMeta("ensayes"),
  pedimentos: canonicalLayerMeta("pedimentos"),
};

export function ProjectMasterViewer({
  projectName,
  onMapReady,
  basemapOverride,
  reportMapId,
  center,
  concessions,
  anomalies,
  drillGrid,
  pedimentos,
  assays = EMPTY_ASSAYS,
  coverage,
  geophysics = null,
  franjas = null,
  yacimientos = null,
  geoquimica = null,
  estructuras = null,
  pedimentosPendientes = null,
  mojones = null,
  height = 620,
  enableLayerTools = false,
  anomalyIntensityDisabledReason,
  spectralFootprintsOnly = false,
  coordinateNotice,
  contextLayers,
}: MasterViewerProps) {
  const readyCallback = useRef(onMapReady);
  readyCallback.current = onMapReady;
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groups = useRef<Partial<Record<LayerKey, Layer>>>({});
  const basesRef = useRef<{ sat?: TileLayer; topo?: TileLayer }>({});
  const [ready, setReady] = useState(false);
  const { visible, setVisible, opacity, setOpacity } = useGeoLayerPreferences<LayerKey>(
    enableLayerTools ? (reportMapId ?? projectName) : null,
    {
      tenencia: true,
      pedimentosPendientes: true,
      mojones: false,
      halos: true,
      halosIntensidad: false,
      magneticaRegional: !enableLayerTools,
      gravedadRegional: false,
      geofisicaProyecto: true,
      magSurfaceProject: true,
      ipChargeSurfaceProject: false,
      ipResSurfaceProject: false,
      relieve: false,
      franjas: false,
      yacimientos: true,
      geoquimica: true,
      estructuras: true,
      sondajes: true,
      ensayes: true,
      pedimentos: true,
    },
  );
  const [layerSearch, setLayerSearch] = useState("");
  const [base, setBase] = useState<"sat" | "topo">("sat");
  const [selected, setSelected] = useState<Selected>(null);
  const [collapsed, setCollapsed] = useState(false);
  // En celular el panel de capas tapa el mapa: arranca plegado.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setCollapsed(true);
  }, []);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LAYER_SECTIONS.map((s) => [s.title, Boolean(s.defaultOpen)])),
  );
  const toggleSection = (title: string) =>
    setOpenSections((state) => ({ ...state, [title]: !state[title] }));
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  /** Reencuadra el mapa a los datos de proyecto disponibles (botón "Encuadrar"). */
  const fitToData = () => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    try {
      const bounds = L.latLngBounds([]);
      [concessions, anomalies, drillGrid].forEach((fc) => {
        if (fc)
          L.geoJSON(fc as never).eachLayer((ly) =>
            bounds.extend((ly as LeafletGeoJSON).getBounds()),
          );
      });
      assays.forEach((a) => bounds.extend([a.lat, a.lng]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {
      /* sin bounds válidos */
    }
  };

  // Construcción imperativa del mapa (client-only; leaflet toca window).
  useEffect(() => {
    let disposed = false;
    setReady(false);
    groups.current = {};
    void (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView(
        [center.lat, center.lng],
        13,
      );
      // Zoom abajo-derecha: arriba-izquierda es territorio de la barra de herramientas/capas.
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      basesRef.current.sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        // crossOrigin: Esri sirve CORS abierto; sin esto, capturar el mapa a PDF
        // (html2canvas) produce un lienzo vacío en vez del mapa satelital real.
        { maxZoom: 19, crossOrigin: "anonymous" },
      ).addTo(map);
      basesRef.current.topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        crossOrigin: "anonymous",
      });

      // --- Geofísica pública regional REAL (WMS): EMAG2 v3 (NOAA, magnetometría),
      // WGM2012 Bouguer (BGI, gravedad), hillshade SRTM (Esri). La magnética queda
      // visible por defecto para que la geofísica real se vea al abrir; los badges
      // DERIVADO + escala (~3.7 km reg.) evitan confundirla con detalle de prospecto.
      const regionalOverlays = buildGeophysicsOverlays(L);
      groups.current.magneticaRegional = regionalOverlays["Magnetometría EMAG2 (regional)"];
      groups.current.gravedadRegional = regionalOverlays["Gravimetría Bouguer WGM2012 (regional)"];
      groups.current.relieve = regionalOverlays["Hillshade SRTM (Esri)"];

      const sel = (kind: LayerKey, props: Record<string, unknown>) => setSelected({ kind, props });

      // --- Geofísica del proyecto: superficies primero, estaciones/líneas encima.
      // Las superficies sólo aceptan estaciones CAMPO (is_synthetic=false) y
      // se etiquetan como DERIVADO/IDW, nunca como inversión ni observación directa.
      if (geophysics && (geophysics.lines.length || geophysics.stations.length)) {
        const magneticSurface = buildFieldGeophysicsSurface(geophysics.stations, "mag_residual_nt");
        const ipChargeSurface = buildFieldGeophysicsSurface(
          geophysics.stations,
          "ip_chargeability_mvv",
        );
        const ipResSurface = buildFieldGeophysicsSurface(
          geophysics.stations,
          "ip_resistivity_ohmm",
        );

        if (magneticSurface) {
          groups.current.magSurfaceProject = buildGeophysicsSurfaceLayer(L, magneticSurface).addTo(
            map,
          );
        }
        if (ipChargeSurface) {
          groups.current.ipChargeSurfaceProject = buildGeophysicsSurfaceLayer(L, ipChargeSurface);
        }
        if (ipResSurface) {
          groups.current.ipResSurfaceProject = buildGeophysicsSurfaceLayer(L, ipResSurface);
        }

        groups.current.geofisicaProyecto = buildGeophysicsLayer(
          L,
          geophysics.surveys,
          geophysics.lines,
          geophysics.stations,
        ).addTo(map);
      }

      // --- Tenencia (catastro SERNAGEOMIN: tenencia del proyecto vs contexto oficial)
      if (concessions?.features?.length) {
        const isOwn = (f?: Feature) => Boolean(f?.properties?.es_tenencia_proyecto);
        const ownFeatures = concessions.features.filter((f) => isOwn(f as Feature));
        // Halo de contraste bajo la tenencia propia: la despega del relieve satelital.
        const halo = L.geoJSON({ type: "FeatureCollection", features: ownFeatures } as never, {
          interactive: false,
          style: () => ({ color: geoColors.outline, weight: 6, opacity: 0.55, fill: false }),
        });
        const g = L.geoJSON(concessions as never, {
          style: (f?: Feature) =>
            isOwn(f)
              ? {
                  color: geoColors.tenureOwn,
                  weight: 3,
                  opacity: 1,
                  fillColor: geoColors.tenureOwn,
                  fillOpacity: 0.24,
                }
              : {
                  color: geoColors.tenureNeighbor,
                  weight: 0.8,
                  opacity: 0.55,
                  dashArray: "3 3",
                  fillOpacity: 0.03,
                },
          onEachFeature: (f: Feature, layer) => {
            if (isOwn(f)) {
              const p = (f.properties ?? {}) as Record<string, unknown>;
              const name = String(p.nombre ?? p.name ?? p.NOMBRE ?? p.codigo ?? "").trim();
              if (name) {
                layer.bindTooltip(name, {
                  permanent: true,
                  direction: "center",
                  className: "gc-own-concession-label",
                });
              }
            }
            layer.on("click", () =>
              sel("tenencia", (f.properties ?? {}) as Record<string, unknown>),
            );
          },
        });
        groups.current.tenencia = L.layerGroup([halo, g]).addTo(map);
        g.eachLayer((l) => {
          const ft = (l as unknown as { feature?: Feature }).feature;
          if (isOwn(ft)) (l as unknown as { bringToFront?: () => void }).bringToFront?.();
        });
      }

      // --- Halos satelitales: núcleo nítido + anillos difusos concéntricos.
      // Los anillos son REPRESENTACIÓN de la firma espectral (dispersión), no
      // una extensión de alteración medida: el radio no es un dato.
      if (anomalies?.features?.length) {
        const layers: L.Layer[] = [];
        for (const f of anomalies.features) {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const code = String(p.index_code ?? "CLAY_MINERALS");
          const color = ALTERATION_COLOR[code] ?? geoColors.clay;
          const inside = Boolean(p.dentro_concesion);

          // Centroide y radio aparente del polígono (para el halo difuso).
          const coords: Array<[number, number]> = [];
          const walk = (c: unknown): void => {
            if (!Array.isArray(c)) return;
            if (typeof c[0] === "number" && typeof c[1] === "number") {
              coords.push([c[0] as number, c[1] as number]);
              return;
            }
            (c as unknown[]).forEach(walk);
          };
          walk((f.geometry as { coordinates?: unknown })?.coordinates);

          if (coords.length && !spectralFootprintsOnly) {
            const lngs = coords.map((c) => c[0]);
            const lats = coords.map((c) => c[1]);
            const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const spanM =
              Math.max(
                (Math.max(...lats) - Math.min(...lats)) * 111_320,
                (Math.max(...lngs) - Math.min(...lngs)) *
                  111_320 *
                  Math.cos((cLat * Math.PI) / 180),
              ) / 2;
            const base = Math.max(spanM, 90);
            // Tres anillos decrecientes en opacidad: efecto de dispersión.
            [
              [2.2, 0.05],
              [1.6, 0.08],
              [1.2, 0.12],
            ].forEach(([mult, op]) => {
              layers.push(
                L.circle([cLat, cLng], {
                  radius: base * mult,
                  stroke: false,
                  fillColor: color,
                  fillOpacity: inside ? op : op * 0.55,
                  interactive: false,
                }),
              );
            });
          }

          const core = L.geoJSON(f as never, {
            style: {
              color,
              weight: inside ? 2 : 1,
              dashArray: inside ? undefined : "4 4",
              opacity: inside ? 0.95 : 0.6,
              fillColor: color,
              fillOpacity: inside ? 0.38 : 0.18,
            },
            onEachFeature: (_ff: Feature, layer) => layer.on("click", () => sel("halos", p)),
          });
          layers.push(core);
        }
        groups.current.halos = L.layerGroup(layers).addTo(map);
      }

      // --- Mapa de intensidad (IDW) de las mismas anomalías satelitales: en vez
      // de polígonos discretos por firma, interpola el z-score sobre una grilla
      // continua — mismo lenguaje visual que un mapa de kriging (azul→magenta).
      // Es visualización derivada, no reemplaza el detalle por firma de "halos".
      if (!anomalyIntensityDisabledReason && anomalies?.features?.length) {
        const points: Array<{ lat: number; lng: number; value: number }> = [];
        for (const f of anomalies.features) {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const value = Number(p.z_score ?? p.score);
          if (!Number.isFinite(value)) continue;

          const coords: Array<[number, number]> = [];
          const walk = (c: unknown): void => {
            if (!Array.isArray(c)) return;
            if (typeof c[0] === "number" && typeof c[1] === "number") {
              coords.push([c[0] as number, c[1] as number]);
              return;
            }
            (c as unknown[]).forEach(walk);
          };
          walk((f.geometry as { coordinates?: unknown })?.coordinates);
          if (!coords.length) continue;

          const lngs = coords.map((c) => c[0]);
          const lats = coords.map((c) => c[1]);
          const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          points.push({ lat: cLat, lng: cLng, value });
        }

        const surface = buildAnomalySurface(points, { unit: "z-score" });
        if (surface) {
          groups.current.halosIntensidad = buildAnomalySurfaceLayer(L, surface);
        }
      }

      // --- Sondajes propuestos (marcador + proyección de azimut)
      if (drillGrid?.features?.length) {
        const items: L.Layer[] = [];
        for (const f of drillGrid.features) {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const g = f.geometry;
          if (!g || g.type !== "Point") continue;
          const [lng, lat] = g.coordinates as [number, number];
          const m = L.circleMarker([lat, lng], {
            radius: 7,
            color: geoColors.contrast,
            weight: 1.4,
            fillColor: geoColors.proposedDrill,
            fillOpacity: 1,
          }).on("click", () => sel("sondajes", p));
          items.push(m);
          const az = Number(p.azimuth_deg ?? 0);
          const a = (az * Math.PI) / 180;
          const planned = enableLayerTools
            ? proposedTraceEnd([0, 0, 0], az, Number(p.dip_deg), Number(p.depth_m))
            : null;
          if (enableLayerTools && !planned) continue;
          const endLat = planned
            ? lat - planned[2] / TERRAIN_METERS_PER_DEGREE
            : lat + 0.004 * Math.cos(a);
          const endLng = planned
            ? lng + planned[0] / (TERRAIN_METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
            : lng + 0.004 * Math.sin(a);
          items.push(
            L.polyline(
              [
                [lat, lng],
                [endLat, endLng],
              ],
              { color: geoColors.proposedDrill, weight: 2 },
            ),
          );
        }
        groups.current.sondajes = L.layerGroup(items).addTo(map);
      }

      // --- Ensayes certificados
      if (assays.length) {
        const items = assays
          .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
          .map((a) =>
            L.circleMarker([a.lat, a.lng], {
              radius: 6,
              color: geoColors.sampleOutline,
              weight: 1,
              fillColor: a.certified === false ? geoColors.declared : geoColors.sample,
              fillOpacity: 1,
            }).on("click", () => sel("ensayes", a as unknown as Record<string, unknown>)),
          );
        groups.current.ensayes = L.layerGroup(items).addTo(map);
      }

      // --- Pedimentos propuestos (rectángulo dorado punteado)
      if (pedimentos?.features?.length) {
        const g = L.geoJSON(pedimentos as never, {
          style: {
            color: geoColors.pedimento,
            weight: 2,
            dashArray: "6 4",
            fillColor: geoColors.pedimento,
            fillOpacity: 0.1,
          },
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () =>
              sel("pedimentos", (f.properties ?? {}) as Record<string, unknown>),
            ),
        });
        groups.current.pedimentos = L.layerGroup([g]).addTo(map);
      }

      // --- Franjas metalogénicas (contexto oficial; polígono tenue de fondo)
      if (franjas?.features?.length) {
        const g = L.geoJSON(franjas as never, {
          style: {
            color: geoColors.pending,
            weight: 1,
            fillColor: geoColors.pending,
            fillOpacity: 0.06,
          },
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () =>
              sel("franjas", (f.properties ?? {}) as Record<string, unknown>),
            ),
        });
        groups.current.franjas = L.layerGroup([g]);
      }

      // --- Yacimientos / minerales críticos (depósitos conocidos; rombo)
      if (yacimientos?.features?.length) {
        const items: L.Layer[] = [];
        for (const f of yacimientos.features) {
          const gm = f.geometry;
          if (!gm || gm.type !== "Point") continue;
          const [lng, lat] = gm.coordinates as [number, number];
          items.push(
            L.marker([lat, lng], {
              icon: L.divIcon({
                className: "",
                html: '<div style="width:12px;height:12px;background:var(--geo-deposit);border:1.5px solid var(--geo-contrast);transform:rotate(45deg)"></div>',
                iconSize: [12, 12],
              }),
            }).on("click", () =>
              sel("yacimientos", (f.properties ?? {}) as Record<string, unknown>),
            ),
          );
        }
        groups.current.yacimientos = L.layerGroup(items).addTo(map);
      }

      // --- Geoquímica de sedimentos (símbolo graduado por Cu; MEDIDO)
      if (geoquimica?.features?.length) {
        const cus = geoquimica.features
          .map((f) => Number((f.properties as Record<string, unknown>)?.Cu))
          .filter((x) => Number.isFinite(x));
        const cuMax = cus.length ? Math.max(...cus) : 1;
        const items: L.Layer[] = [];
        for (const f of geoquimica.features) {
          const gm = f.geometry;
          if (!gm || gm.type !== "Point") continue;
          const [lng, lat] = gm.coordinates as [number, number];
          const cu = Number((f.properties as Record<string, unknown>)?.Cu) || 0;
          items.push(
            L.circleMarker([lat, lng], {
              radius: 4 + 8 * (cu / (cuMax || 1)),
              color: geoColors.depositOutline,
              weight: 0.8,
              fillColor: geoColors.ironOxide,
              fillOpacity: 0.8,
            }).on("click", () =>
              sel("geoquimica", (f.properties ?? {}) as Record<string, unknown>),
            ),
          );
        }
        groups.current.geoquimica = L.layerGroup(items).addTo(map);
      }

      // --- Estructuras (vetas con rumbo/manteo medido en terreno; MEDIDO)
      if (estructuras?.features?.length) {
        const line = L.geoJSON(estructuras as never, {
          style: { color: geoColors.structure, weight: 3, opacity: 0.9 },
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () =>
              sel("estructuras", (f.properties ?? {}) as Record<string, unknown>),
            ),
        });
        groups.current.estructuras = line.addTo(map);
      }

      // --- Pedimentos sin publicar (declarados por el titular, no en catastro oficial)
      if (pedimentosPendientes?.features?.length) {
        const g = L.geoJSON(pedimentosPendientes as never, {
          style: {
            color: geoColors.geochemistry,
            weight: 1.6,
            dashArray: "5 4",
            fillColor: geoColors.geochemistry,
            fillOpacity: 0.05,
          },
          pointToLayer: (f, latlng) =>
            L.circleMarker(latlng, {
              radius: 6,
              color: geoColors.geochemistry,
              weight: 1.6,
              dashArray: "3 2",
              fillColor: geoColors.geochemistry,
              fillOpacity: 0.4,
            }),
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () =>
              sel("pedimentosPendientes", (f.properties ?? {}) as Record<string, unknown>),
            ),
        });
        groups.current.pedimentosPendientes = g.addTo(map);
      }

      // --- Mojones / hitos de mensura (HM) declarados por el titular
      if (mojones?.features?.length) {
        const items: L.Layer[] = [];
        for (const f of mojones.features) {
          const gm = f.geometry;
          if (!gm || gm.type !== "Point") continue;
          const [lng, lat] = gm.coordinates as [number, number];
          items.push(
            L.circleMarker([lat, lng], {
              radius: 3.5,
              color: geoColors.markerOutline,
              weight: 1.4,
              fillColor: geoColors.markerFill,
              fillOpacity: 0.9,
            }).on("click", () => sel("mojones", (f.properties ?? {}) as Record<string, unknown>)),
          );
        }
        groups.current.mojones = L.layerGroup(items).addTo(map);
      }

      // Encuadrar a lo que exista
      try {
        const bounds = L.latLngBounds([]);
        [concessions, anomalies, drillGrid].forEach((fc) => {
          if (fc)
            L.geoJSON(fc as never).eachLayer((ly) =>
              bounds.extend((ly as never as LeafletGeoJSON).getBounds()),
            );
        });
        assays.forEach((a) => bounds.extend([a.lat, a.lng]));
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch {
        /* sin bounds válidos */
      }

      readyCallback.current?.(map);
      setReady(true);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    geophysics,
    concessions,
    anomalies,
    drillGrid,
    pedimentos,
    assays,
    franjas,
    yacimientos,
    geoquimica,
    estructuras,
    pedimentosPendientes,
    mojones,
    center.lat,
    center.lng,
    spectralFootprintsOnly,
  ]);

  const [contextSettings, setContextSettings] = useState<
    Record<string, { visible: boolean; opacity: number }>
  >({});
  useEffect(() => {
    const map = mapRef.current,
      L = leafletRef.current;
    if (!map || !L || !ready) return;
    const layers: Layer[] = [];
    for (const entry of contextLayers ?? []) {
      const setting = contextSettings[entry.id] ?? { visible: true, opacity: 0.8 };
      if (!setting.visible) continue;
      const color = (feature?: Feature) =>
        typeof entry.color === "function"
          ? entry.color(feature?.properties ?? {})
          : (entry.color ?? geoColors.context);
      const layer = L.geoJSON(entry.features as never, {
        style: (feature) => ({
          color: color(feature),
          weight: 2,
          opacity: setting.opacity,
          fillOpacity: setting.opacity * 0.15,
        }),
        pointToLayer: (feature, point) =>
          L.circleMarker(point, {
            radius: 5,
            color: color(feature),
            opacity: setting.opacity,
            fillOpacity: setting.opacity,
          }),
        onEachFeature: (feature, item) => {
          const content = document.createElement("div");
          content.textContent =
            entry.label +
            " · " +
            (entry.evidenceForFeature?.(feature.properties ?? {}) ?? entry.evidence) +
            "\n" +
            (entry.caution ? entry.caution + "\n" : "") +
            Object.entries(feature.properties ?? {})
              .filter(([, value]) => value != null && typeof value !== "object")
              .map(([key, value]) => key + ": " + String(value))
              .join("\n");
          content.style.whiteSpace = "pre-line";
          item.bindPopup(content);
        },
      }).addTo(map);
      layers.push(layer);
    }
    return () => {
      for (const layer of layers) map.removeLayer(layer);
    };
  }, [ready, contextLayers, contextSettings]);

  // Toggle de capas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (Object.keys(visible) as LayerKey[]).forEach((k) => {
      const g = groups.current[k];
      if (!g) return;
      if (visible[k]) g.addTo(map);
      else map.removeLayer(g);
    });
  }, [visible, ready]);

  useEffect(() => {
    if (!ready) return;
    for (const key of Object.keys(opacity) as LayerKey[]) {
      const layer = groups.current[key];
      if (layer) applyLayerOpacity(layer, opacity[key] ?? 1);
    }
  }, [opacity, ready]);

  const fitToLayer = (key: LayerKey) => {
    const map = mapRef.current,
      L = leafletRef.current,
      layer = groups.current[key];
    if (!map || !L || !layer) return;
    const bounds = L.latLngBounds([]);
    const collect = (item: Layer) => {
      const geo = item as Layer & {
        getBounds?: () => import("leaflet").LatLngBounds;
        getLatLng?: () => import("leaflet").LatLng;
        eachLayer?: (visit: (child: Layer) => void) => void;
      };
      if (geo.getBounds) {
        const child = geo.getBounds();
        if (child.isValid()) bounds.extend(child);
      } else if (geo.getLatLng) bounds.extend(geo.getLatLng());
      else geo.eachLayer?.(collect);
    };
    collect(layer);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  useEffect(() => {
    if (basemapOverride) setBase(basemapOverride === "satellite" ? "sat" : "topo");
  }, [basemapOverride]);

  // Switch de capa base
  useEffect(() => {
    const map = mapRef.current;
    const b = basesRef.current;
    if (!map || !ready || !b.sat || !b.topo) return;
    if (base === "sat") {
      map.removeLayer(b.topo);
      b.sat.addTo(map);
    } else {
      map.removeLayer(b.sat);
      b.topo.addTo(map);
    }
  }, [base, ready]);

  const legend = useMemo(
    () =>
      Object.entries(ALTERATION_LABEL).map(([k, label]) => ({ label, color: ALTERATION_COLOR[k] })),
    [],
  );

  const geophysicsStatus = useMemo(() => {
    const stations = geophysics?.stations ?? [];
    const field = stations.filter((station) => !station.is_synthetic);
    const synthetic = stations.length - field.length;
    return {
      field: field.length,
      synthetic,
      magnetic: field.filter((station) => station.mag_nt != null).length,
      ipCharge: field.filter((station) => station.ip_chargeability_mvv != null).length,
      ipRes: field.filter((station) => station.ip_resistivity_ohmm != null).length,
    };
  }, [geophysics]);

  useEffect(() => {
    if (!ready || !mapEl.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        mapRef.current?.invalidateSize({ pan: false });
      }
    });
    observer.observe(mapEl.current);
    return () => observer.disconnect();
  }, [ready]);

  // Conteo de datos reales por capa. Las capas sin datos NO se muestran en la
  // leyenda (evita el visor "recargado" con capas vacías, p.ej. geofísica en 0).
  const counts = useMemo<Record<LayerKey, number>>(
    () => ({
      tenencia: concessions?.features?.length ?? 0,
      pedimentosPendientes: pedimentosPendientes?.features?.length ?? 0,
      mojones: mojones?.features?.length ?? 0,
      halos: anomalies?.features?.length ?? 0,
      halosIntensidad:
        !anomalyIntensityDisabledReason && (anomalies?.features?.length ?? 0) >= 4
          ? (anomalies?.features.length ?? 0)
          : 0,
      sondajes: drillGrid?.features?.length ?? 0,
      ensayes: assays.length,
      pedimentos: pedimentos?.features?.length ?? 0,
      franjas: franjas?.features?.length ?? 0,
      yacimientos: yacimientos?.features?.length ?? 0,
      geoquimica: geoquimica?.features?.length ?? 0,
      estructuras: estructuras?.features?.length ?? 0,
      geofisicaProyecto: geophysicsStatus.field + geophysicsStatus.synthetic,
      magSurfaceProject: geophysicsStatus.magnetic >= 4 ? geophysicsStatus.magnetic : 0,
      ipChargeSurfaceProject: geophysicsStatus.ipCharge >= 4 ? geophysicsStatus.ipCharge : 0,
      ipResSurfaceProject: geophysicsStatus.ipRes >= 4 ? geophysicsStatus.ipRes : 0,
      // Contexto global (siempre disponible; sin conteo de features de proyecto).
      magneticaRegional: 1,
      gravedadRegional: 1,
      relieve: 1,
    }),
    [
      concessions,
      anomalies,
      drillGrid,
      assays,
      pedimentos,
      geophysicsStatus,
      franjas,
      yacimientos,
      geoquimica,
      estructuras,
      pedimentosPendientes,
      mojones,
      anomalyIntensityDisabledReason,
    ],
  );
  // Capas cuyo conteo representa nº de features (se muestra "· N"); el resto es contexto.
  const COUNTED: ReadonlyArray<LayerKey> = [
    "tenencia",
    "pedimentosPendientes",
    "mojones",
    "halos",
    "halosIntensidad",
    "sondajes",
    "ensayes",
    "pedimentos",
    "geofisicaProyecto",
    "franjas",
    "yacimientos",
    "geoquimica",
    "estructuras",
  ];
  const visibleSections = useMemo(
    () =>
      LAYER_SECTIONS.map((s) => ({
        ...s,
        layers: s.layers.filter(
          ([k, label]) =>
            counts[k] > 0 &&
            (label + " " + s.title)
              .toLocaleLowerCase("es")
              .includes(layerSearch.toLocaleLowerCase("es")),
        ),
      })).filter((s) => s.layers.length > 0),
    [counts, layerSearch],
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-hairline bg-surface">
      {!!contextLayers?.length && (
        <details className="border-b border-hairline px-4 py-3 text-xs">
          <summary className="cursor-pointer font-mono">Capas de evidencia del proyecto</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            {contextLayers.map((entry) => (
              <label key={entry.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contextSettings[entry.id]?.visible ?? true}
                  onChange={(event) =>
                    setContextSettings((state) => ({
                      ...state,
                      [entry.id]: {
                        opacity: state[entry.id]?.opacity ?? 0.8,
                        visible: event.target.checked,
                      },
                    }))
                  }
                />
                {entry.label} · {entry.evidence} · {entry.features.features.length}
                <input
                  aria-label={"Opacidad " + entry.label}
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={contextSettings[entry.id]?.opacity ?? 0.8}
                  onChange={(event) =>
                    setContextSettings((state) => ({
                      ...state,
                      [entry.id]: {
                        visible: state[entry.id]?.visible ?? true,
                        opacity: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </details>
      )}
      {/* Cabecera: métrica de cobertura + descargo del halo */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-content">
            {projectName} · visor geoespacial
          </div>
          <div className="text-[11px] text-content-subtle">
            Una sola vista: territorio, teledetección, geofísica regional y exploración. Cada capa
            conserva su procedencia y escala; una anomalía regional no se presenta como blanco de
            perforación ni como extensión mineralizada.
          </div>
        </div>
        {coverage && (
          <div className="text-right text-[11px] text-content-muted">
            <div>
              Cobertura interpretable: <b className="text-content">{coverage.typicalPct ?? "—"}%</b>{" "}
              típico
              {" · "}
              {coverage.bestcasePct ?? "—"}% mejor caso
            </div>
            <div className={coverage.conclusive ? "text-emerald-600" : "text-amber-600"}>
              {coverage.conclusive
                ? "Espectral aplicable"
                : "Espectral no concluyente — valor en estructura"}
            </div>
          </div>
        )}
      </div>

      {(anomalyIntensityDisabledReason || coordinateNotice) && (
        <div className="space-y-1 border-b border-hairline px-4 py-2 text-[11px] text-content-subtle">
          {anomalyIntensityDisabledReason && <p>{anomalyIntensityDisabledReason}</p>}
          {coordinateNotice && <p>{coordinateNotice}</p>}
        </div>
      )}

      <div className="relative flex" style={{ height }}>
        {/* Mapa */}
        <div ref={mapEl} data-report-map={reportMapId} className="h-full flex-1" />

        {/* Barra de herramientas (fija, nunca se pierde en el scroll de capas) */}
        <div className="pointer-events-auto absolute left-3 top-3 z-[510] flex items-center gap-1 rounded-lg border border-hairline bg-surface/95 p-1 text-[11px] shadow">
          <div className="flex overflow-hidden rounded border border-hairline">
            {(["sat", "topo"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBase(b)}
                title={b === "sat" ? "Base satelital" : "Base topográfica"}
                className={`px-2 py-1 ${
                  base === b ? "bg-accent-brand text-accent-brand-contrast" : "hover:bg-surface-2"
                }`}
              >
                {b === "sat" ? "Satélite" : "Topo"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={fitToData}
            title="Encuadrar a los datos del proyecto"
            className="flex items-center gap-1 rounded border border-hairline px-2 py-1 hover:bg-surface-2"
          >
            <Maximize className="h-3 w-3" /> Encuadrar
          </button>
        </div>

        {/* Panel de capas (izquierda-flotante) — colapsable; secciones colapsables; solo con datos.
            Colapsado: alto automático (solo la cabecera). Expandido: se estira hasta
            `bottom-3` para que la lista scrollee dentro de la altura del mapa. Antes el
            contenedor SIEMPRE ocupaba top-11→bottom-3 (con fondo semi-opaco), tapando el
            mapa con un bloque en blanco aunque el panel estuviera colapsado. */}
        <div
          className={`pointer-events-auto absolute left-3 top-11 z-[500] flex w-60 flex-col rounded-lg border border-hairline bg-surface/95 text-[12px] shadow ${
            collapsed ? "" : "bottom-3"
          }`}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-between px-2 py-1.5 font-semibold text-content"
          >
            <span>Capas de evidencia</span>
            <span className="text-content-subtle">{collapsed ? "▸" : "▾"}</span>
          </button>
          {!collapsed && (
            <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
              {enableLayerTools && (
                <input
                  type="search"
                  value={layerSearch}
                  onChange={(e) => setLayerSearch(e.target.value)}
                  aria-label="Buscar capas"
                  placeholder="Buscar capas"
                  className="mb-2 w-full rounded border border-hairline bg-surface px-2 py-1.5 text-[11px]"
                />
              )}
              {visibleSections.map((section, index) => {
                const open = openSections[section.title] ?? false;
                const Icon = section.icon;
                const visibleCount = section.layers.filter(([k]) => visible[k]).length;
                return (
                  <div
                    key={section.title}
                    className={index > 0 ? "mt-1 border-t border-hairline pt-1" : ""}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.title)}
                      className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-surface-2"
                    >
                      {open ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-content-subtle" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-content-subtle" />
                      )}
                      <Icon className="h-3.5 w-3.5 shrink-0 text-content-subtle" />
                      <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-content">
                        {section.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-content-subtle">
                        {visibleCount}/{section.layers.length}
                      </span>
                    </button>
                    {open && (
                      <div className="pb-1 pl-1">
                        {section.note && (
                          <div className="mb-1 px-1 text-[9px] leading-tight text-content-subtle">
                            {section.note}
                          </div>
                        )}
                        {section.title === "Geofísica" && geophysicsStatus.field > 0 && (
                          <div className="mb-1 px-1 text-[9px] leading-tight text-content-subtle">
                            CAMPO: {geophysicsStatus.field} · SIMULADO: {geophysicsStatus.synthetic}
                            . Halo requiere ≥4 puntos CAMPO por variable.
                          </div>
                        )}
                        {section.layers.map(([k, label]) => (
                          <div key={k} className="mb-1">
                            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-surface-2">
                              <input
                                className="mt-0.5"
                                type="checkbox"
                                checked={visible[k]}
                                onChange={(e) =>
                                  setVisible((state) => ({ ...state, [k]: e.target.checked }))
                                }
                              />
                              <span className="min-w-0 flex-1 text-content-muted">
                                <span className="flex items-center gap-1">
                                  <span className="truncate">
                                    {k === "halos" && spectralFootprintsOnly
                                      ? "Huellas espectrales · Sentinel-2"
                                      : k === "ensayes" && assays.some((a) => a.certified === false)
                                        ? "Ensayes y observaciones"
                                        : label}
                                  </span>
                                  {COUNTED.includes(k) && (
                                    <span className="shrink-0 text-content-subtle">
                                      · {counts[k]}
                                    </span>
                                  )}
                                </span>
                                {k === "ensayes" && assays.some((a) => a.certified === false) ? (
                                  <span className="mt-0.5 block text-[9px] text-content-subtle">
                                    {assays.filter((a) => a.certified !== false).length} ensayes
                                    certificados ·{" "}
                                    {assays.filter((a) => a.certified === false).length}{" "}
                                    observaciones documentales
                                  </span>
                                ) : (
                                  <EvidenceBadge
                                    kind={LAYER_META[k].evidence}
                                    scale={LAYER_META[k].scale}
                                    size="xs"
                                    className="mt-0.5"
                                  />
                                )}
                              </span>
                            </label>
                            {enableLayerTools && (
                              <div className="ml-6 flex items-center gap-2 pb-1">
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={opacity[k] ?? 1}
                                  disabled={!visible[k]}
                                  aria-label={`Opacidad de ${label}`}
                                  onChange={(e) =>
                                    setOpacity((state) => ({
                                      ...state,
                                      [k]: Number(e.target.value),
                                    }))
                                  }
                                  className="min-w-0 flex-1 accent-gold"
                                />
                                <span className="w-7 text-right text-[9px] tabular-nums">
                                  {Math.round((opacity[k] ?? 1) * 100)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => fitToLayer(k)}
                                  aria-label={`Encuadrar ${label}`}
                                  className="rounded p-1 hover:bg-surface-2"
                                >
                                  <Maximize className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leyendas flotantes (firma espectral + intensidad IDW) — apiladas sin
            hueco fijo entre ellas, cada una condicional a su propia capa. */}
        {((visible.halos && counts.halos > 0) ||
          (visible.halosIntensidad && counts.halosIntensidad > 0)) && (
          <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col gap-2">
            {visible.halos && counts.halos > 0 && (
              <div className="rounded-lg border border-hairline bg-surface/95 px-2 py-1.5 text-[11px] shadow">
                <div className="mb-1 font-semibold text-content">Firma espectral · Sentinel-2</div>
                {legend.map((l) => (
                  <div key={l.label} className="flex items-center gap-2 py-0.5 text-content-muted">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: l.color }}
                    />
                    {l.label}
                  </div>
                ))}
              </div>
            )}

            {visible.halosIntensidad && counts.halosIntensidad > 0 && (
              <div className="rounded-lg border border-hairline bg-surface/95 px-2 py-1.5 text-[11px] shadow">
                <div className="mb-1 font-semibold text-content">Intensidad · IDW (z-score)</div>
                <div
                  className="h-2.5 w-32 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${ANOMALY_GRADIENT_STOPS.map(
                      ([t, color]) => `${color} ${t * 100}%`,
                    ).join(", ")})`,
                  }}
                />
                <div className="mt-0.5 flex justify-between text-content-muted">
                  <span>bajo</span>
                  <span>alto</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inspector lateral (docked) */}
        {selected && (
          <div className="z-[500] w-72 shrink-0 overflow-auto border-l border-hairline bg-surface p-3 text-[12px]">
            <Inspector selected={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ kind }: { kind: ProvKind }) {
  const p = PROV[kind];
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold text-accent-brand-contrast"
      style={{ background: p.bg }}
    >
      {p.label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-content-subtle">{k}</span>
      <span className="text-right text-content">{String(v)}</span>
    </div>
  );
}

function Inspector({
  selected,
  onClose,
}: {
  selected: NonNullable<Selected>;
  onClose: () => void;
}) {
  const p = selected.props;
  const num = (x: unknown, d = 2) =>
    typeof x === "number" ? x.toFixed(d) : x != null && x !== "" ? String(x) : undefined;

  let title = "Detalle";
  let prov: ProvKind = "derivado";
  let rows: Array<[string, unknown]> = [];

  if (selected.kind === "ensayes") {
    title = `${p.certified === false ? "Observación" : "Ensaye"} ${p.code ?? ""}`;
    prov = p.certified === false ? "declarado" : "certificado";
    rows = [
      ["CuT (%)", num(p.cuTotalPct)],
      ["CuS (%)", num(p.cuSolublePct)],
      ["Au (g/t)", num(p.auGpt)],
      ["Ag (ppm)", num(p.agPpm, 1)],
      ["Laboratorio", p.lab],
      ["Informe", p.reportId],
      ["Fecha del informe", p.reportDate],
      ["Lat, Lng", `${num(p.lat, 5)}, ${num(p.lng, 5)}`],
    ];
  } else if (selected.kind === "halos") {
    title = "Anomalía espectral";
    prov = p.dentro_concesion ? "derivado" : "contexto";
    rows = [
      ["Firma", ALTERATION_LABEL[String(p.index_code)] ?? String(p.index_code ?? "—")],
      ["Severidad", p.severity],
      ["z-score", num(p.z_score)],
      ["score", num(p.score)],
      ["Dentro de concesión", p.dentro_concesion ? "Sí" : "No"],
      ["Procedencia", p.procedencia],
      ["Método / antecedentes", p.notes],
    ];
  } else if (selected.kind === "sondajes") {
    title = `Sondaje ${p.code ?? ""}`;
    prov = "conceptual";
    rows = [
      ["Azimut", `${num(p.azimuth_deg, 0)}°`],
      ["Inclinación", `${num(p.dip_deg, 0)}°`],
      ["Profundidad", `${num(p.depth_m, 0)} m`],
      ["Prioridad", p.priority],
      ["Este/Norte (UTM)", `${num(p.este_utm, 0)} / ${num(p.norte_utm, 0)}`],
      ["Objetivo", p.objetivo],
    ];
  } else if (selected.kind === "pedimentos") {
    const cn = (p.cara_norte_utm ?? {}) as Record<string, unknown>;
    const lados = (p.lados_m ?? {}) as Record<string, unknown>;
    title = `Pedimento ${p.code ?? ""}`;
    prov = "conceptual";
    rows = [
      ["Superficie", p.area_ha != null ? `${p.area_ha} ha` : undefined],
      ["Lados (m)", `${lados["E-W"] ?? "—"} × ${lados["N-S"] ?? "—"}`],
      ["Cara norte", cn.N != null ? `E ${cn.E_centro} · N ${cn.N}` : undefined],
      ["Datum", p.datum ?? "UTM 19S (SIRGAS)"],
    ];
  } else if (selected.kind === "franjas") {
    title = "Franja metalogénica";
    prov = "contexto";
    rows = [["Franja", p.franja ?? p.Franja]];
  } else if (selected.kind === "yacimientos") {
    title = `Yacimiento ${p.nombre ?? ""}`;
    prov = "contexto";
    rows = [
      ["Sistema mineral", p.sistema],
      ["Modelo de depósito", p.modelo],
      ["Minerales críticos", p.criticos],
      ["Estado", p.estado],
      ["Franja", p.franja],
    ];
  } else if (selected.kind === "geoquimica") {
    title = `Sedimento ${p.muestra ?? ""}`;
    prov = "certificado";
    rows = [
      ["Cu (ppm)", num(p.Cu, 1)],
      ["Au (ppb)", num(p.Au, 1)],
      ["Ag (ppm)", num(p.Ag, 2)],
      ["As (ppm)", num(p.As, 1)],
      ["Mo (ppm)", num(p.Mo, 1)],
      ["La/Ce/Nd (ppm)", `${num(p.La, 0)} / ${num(p.Ce, 0)} / ${num(p.Nd, 0)}`],
    ];
  } else if (selected.kind === "estructuras") {
    title = `Veta ${p.code ?? ""}`;
    prov = "medido";
    rows = [
      ["Descripción", p.name],
      ["Rumbo", `N${p.strikeDeg}°`],
      ["Manteo", p.dipText ?? "No informado"],
      ["Potencia", p.potenciaM ? `${p.potenciaM} m` : "No informado"],
    ];
  } else if (selected.kind === "pedimentosPendientes") {
    title = `${p.nombre ?? "Pedimento"}`;
    prov = "contexto";
    rows = [
      ["Titular", p.titular],
      ["Estado", p.estado],
      ["Fuente", p.fuente],
      ["Verificado en SERNAGEOMIN", p.verificado_sernageomin ? "Sí" : "No"],
    ];
  } else if (selected.kind === "mojones") {
    title = `${p.nombre ?? "Hito de mensura"}`;
    prov = "contexto";
    rows = [
      ["Concesión", p.concesion],
      ["Tipo", p.tipo],
      ["Fuente", p.fuente],
    ];
  } else {
    title = `Concesión ${p.nombre ?? ""}`;
    prov = p.es_tenencia_proyecto ? "declarado" : "contexto";
    rows = [
      ["Rol", p.rol],
      ["Titular", p.titular],
      ["Situación", p.situacion],
      ["Tipo", p.tipo],
      ["Hectáreas", p.hectareas],
      ["Comuna", p.comuna],
      [
        "Tenencia del proyecto",
        p.es_tenencia_proyecto === true
          ? "Declarada"
          : p.es_tenencia_proyecto === false
            ? "No"
            : "Pendiente de verificación",
      ],
    ];
  }

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-semibold text-content">{title}</div>
        <button type="button" onClick={onClose} className="text-content-subtle hover:text-content">
          ✕
        </button>
      </div>
      <div className="mb-2">
        <Badge kind={prov} />
      </div>
      {rows.map(([k, v]) => (
        <Row key={k} k={k} v={v} />
      ))}
      {(selected.kind === "halos" ||
        selected.kind === "sondajes" ||
        selected.kind === "pedimentos" ||
        selected.kind === "geoquimica" ||
        selected.kind === "yacimientos" ||
        selected.kind === "pedimentosPendientes" ||
        selected.kind === "mojones") && (
        <div className="mt-3 rounded bg-surface-2 p-2 text-[10px] text-content-subtle">
          {selected.kind === "halos"
            ? "Detección satelital (Sentinel-2). Anomalía espectral, no identificación mineral ni extensión medida. Requiere verificación de terreno."
            : selected.kind === "sondajes"
              ? "Plataforma propuesta (conceptual). No perforada; no estima recursos ni reservas (NI 43-101)."
              : selected.kind === "geoquimica"
                ? "Geoquímica de sedimento fluvial (SERNAGEOMIN). Dispersión regional en la cuenca, NO ley in situ. Orienta, no prueba mineralización."
                : selected.kind === "yacimientos"
                  ? "Depósito conocido (SERNAGEOMIN, Minerales Críticos). Contexto de distrito; verificar distancia y sistema mineral. No implica continuidad al predio."
                  : selected.kind === "pedimentosPendientes"
                    ? "Declarado por el titular (KML propio), sin confirmar contra catastro oficial SERNAGEOMIN. La geometría puede ser un punto de referencia, no vértices de mensura. Verificar antes de asumir tenencia."
                    : selected.kind === "mojones"
                      ? "Hito de mensura (HM) declarado por el titular. No verificado independientemente por GeoCapitals; usar como referencia, no como control geodésico certificado."
                      : "Propuesta de pedimento (borrador). Vacancia indicativa del catastro SERNAGEOMIN; requiere verificación legal y estudio de títulos antes de constituir. No es la solicitud oficial."}
        </div>
      )}
    </div>
  );
}
