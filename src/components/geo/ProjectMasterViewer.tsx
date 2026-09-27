import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Layer, GeoJSON as LeafletGeoJSON, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import { buildGeophysicsOverlays } from "@/components/map/geophysicsOverlays";
import {
  buildGeophysicsLayer,
  buildGeophysicsSurfaceLayer,
} from "@/components/map/geophysicsLayers";
import { buildFieldGeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import type { GeophysicsData } from "@/types/geophysics";

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
};

export type MasterViewerProps = {
  projectName: string;
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
  height?: number;
};

const ALTERATION_COLOR: Record<string, string> = {
  CLAY_MINERALS: "#0ea5e9", // Al-OH / fílica → cian
  HYDROTHERMAL_ALTERATION: "#d946ef", // hidrotermal mixta → magenta
  IRON_OXIDE: "#f97316", // óxidos / gossan → ámbar
  STRUCTURAL_LINEAMENTS: "#eab308", // lineamientos → dorado
};
const ALTERATION_LABEL: Record<string, string> = {
  CLAY_MINERALS: "Al-OH / arcillas (fílica)",
  HYDROTHERMAL_ALTERATION: "Alteración hidrotermal",
  IRON_OXIDE: "Óxidos de hierro / gossan",
  STRUCTURAL_LINEAMENTS: "Lineamiento estructural",
};

type LayerKey =
  | "tenencia"
  | "halos"
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
  | "sondajes"
  | "ensayes"
  | "pedimentos";
type Selected = { kind: LayerKey; props: Record<string, unknown> } | null;

const LAYER_SECTIONS: ReadonlyArray<{
  title: string;
  note?: string;
  layers: ReadonlyArray<[LayerKey, string]>;
}> = [
  {
    title: "Territorio",
    layers: [
      ["tenencia", "Catastro SERNAGEOMIN"],
      ["relieve", "Relieve / hillshade"],
    ],
  },
  {
    title: "Teledetección",
    note: "Derivado de sensores remotos; requiere validación en terreno.",
    layers: [["halos", "Halos espectrales · Sentinel-2"]],
  },
  {
    title: "Geofísica",
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
    note: "Contexto oficial SERNAGEOMIN: franja metalogénica y depósitos conocidos cercanos.",
    layers: [
      ["franjas", "Franjas metalogénicas"],
      ["yacimientos", "Yacimientos / minerales críticos"],
    ],
  },
  {
    title: "Geoquímica",
    note: "Sedimento fluvial medido (SERNAGEOMIN). Dispersión regional, no ley in situ.",
    layers: [["geoquimica", "Geoquímica de sedimentos · Cu"]],
  },
  {
    title: "Exploración",
    layers: [
      ["ensayes", "Ensayes certificados"],
      ["sondajes", "Sondajes propuestos"],
      ["pedimentos", "Pedimentos propuestos"],
    ],
  },
];

type ProvKind = "certificado" | "derivado" | "conceptual" | "contexto";
const PROV: Record<ProvKind, { label: string; bg: string }> = {
  certificado: { label: "CERTIFICADO", bg: "#15803d" },
  derivado: { label: "DERIVADO", bg: "#0369a1" },
  conceptual: { label: "PROPUESTO / CONCEPTUAL", bg: "#a16207" },
  contexto: { label: "CONTEXTO — verificar tenencia", bg: "#b45309" },
};

// Badge de evidencia + escala/resolución por capa: hace evidente qué está viendo
// el usuario y evita que un raster regional se confunda con geofísica de detalle.
type Evidence = "OFICIAL" | "MEDIDO" | "DERIVADO" | "INTERPRETADO" | "PROPUESTO";
const EVIDENCE_BG: Record<Evidence, string> = {
  OFICIAL: "#15803d",
  MEDIDO: "#0369a1",
  DERIVADO: "#7c3aed",
  INTERPRETADO: "#a16207",
  PROPUESTO: "#b45309",
};
const LAYER_META: Record<LayerKey, { evidence: Evidence; scale: string }> = {
  tenencia: { evidence: "OFICIAL", scale: "catastro" },
  relieve: { evidence: "OFICIAL", scale: "DEM 30 m" },
  franjas: { evidence: "OFICIAL", scale: "regional" },
  yacimientos: { evidence: "OFICIAL", scale: "depósito" },
  geoquimica: { evidence: "MEDIDO", scale: "sedimento" },
  halos: { evidence: "DERIVADO", scale: "10–20 m" },
  magneticaRegional: { evidence: "DERIVADO", scale: "~3.7 km reg." },
  gravedadRegional: { evidence: "DERIVADO", scale: "~10 km reg." },
  geofisicaProyecto: { evidence: "MEDIDO", scale: "estaciones" },
  magSurfaceProject: { evidence: "INTERPRETADO", scale: "CAMPO→IDW" },
  ipChargeSurfaceProject: { evidence: "INTERPRETADO", scale: "CAMPO→IDW" },
  ipResSurfaceProject: { evidence: "INTERPRETADO", scale: "CAMPO→IDW" },
  ensayes: { evidence: "MEDIDO", scale: "puntual" },
  sondajes: { evidence: "PROPUESTO", scale: "conceptual" },
  pedimentos: { evidence: "PROPUESTO", scale: "borrador" },
};

export function ProjectMasterViewer({
  projectName,
  center,
  concessions,
  anomalies,
  drillGrid,
  pedimentos,
  assays = [],
  coverage,
  geophysics = null,
  franjas = null,
  yacimientos = null,
  geoquimica = null,
  height = 620,
}: MasterViewerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groups = useRef<Partial<Record<LayerKey, Layer>>>({});
  const basesRef = useRef<{ sat?: TileLayer; topo?: TileLayer }>({});
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({
    tenencia: true,
    halos: true,
    magneticaRegional: false,
    gravedadRegional: false,
    geofisicaProyecto: false,
    magSurfaceProject: false,
    ipChargeSurfaceProject: false,
    ipResSurfaceProject: false,
    relieve: false,
    franjas: false,
    yacimientos: false,
    geoquimica: false,
    sondajes: false,
    ensayes: true,
    pedimentos: false,
  });
  const [base, setBase] = useState<"sat" | "topo">("sat");
  const [selected, setSelected] = useState<Selected>(null);
  const [collapsed, setCollapsed] = useState(true);

  // Construcción imperativa del mapa (client-only; leaflet toca window).
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: false }).setView(
        [center.lat, center.lng],
        13,
      );
      mapRef.current = map;
      basesRef.current.sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      ).addTo(map);
      basesRef.current.topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
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
        const g = L.geoJSON(concessions as never, {
          style: (f?: Feature) => {
            const own = Boolean(f?.properties?.es_tenencia_proyecto);
            return own
              ? { color: "#e8a33d", weight: 1.6, fillOpacity: 0.06 }
              : {
                  color: "#94a3b8",
                  weight: 0.8,
                  opacity: 0.6,
                  dashArray: "3 3",
                  fillOpacity: 0.02,
                };
          },
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () =>
              sel("tenencia", (f.properties ?? {}) as Record<string, unknown>),
            ),
        });
        groups.current.tenencia = L.layerGroup([g]).addTo(map);
      }

      // --- Halos satelitales (núcleo + halo difuso, color por firma, estilo por tenencia)
      if (anomalies?.features?.length) {
        const layers: LeafletGeoJSON[] = [];
        for (const f of anomalies.features) {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const code = String(p.index_code ?? "CLAY_MINERALS");
          const color = ALTERATION_COLOR[code] ?? "#0ea5e9";
          const inside = Boolean(p.dentro_concesion);
          const halo = L.geoJSON(f as never, {
            style: {
              color,
              weight: inside ? 1.5 : 1,
              dashArray: inside ? undefined : "4 4",
              opacity: inside ? 0.9 : 0.6,
              fillColor: color,
              fillOpacity: 0.14, // halo difuso: representación, no extensión medida
            },
            onEachFeature: (_ff: Feature, layer) => layer.on("click", () => sel("halos", p)),
          });
          layers.push(halo);
        }
        groups.current.halos = L.layerGroup(layers).addTo(map);
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
            color: "#ffffff",
            weight: 1.4,
            fillColor: "#1f6feb",
            fillOpacity: 1,
          }).on("click", () => sel("sondajes", p));
          items.push(m);
          const az = Number(p.azimuth_deg ?? 0);
          const d = 0.004;
          const a = (az * Math.PI) / 180;
          items.push(
            L.polyline(
              [
                [lat, lng],
                [lat + d * Math.cos(a), lng + d * Math.sin(a)],
              ],
              { color: "#1f6feb", weight: 2 },
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
              color: "#052e16",
              weight: 1,
              fillColor: "#22c55e",
              fillOpacity: 1,
            }).on("click", () => sel("ensayes", a as unknown as Record<string, unknown>)),
          );
        groups.current.ensayes = L.layerGroup(items).addTo(map);
      }

      // --- Pedimentos propuestos (rectángulo dorado punteado)
      if (pedimentos?.features?.length) {
        const g = L.geoJSON(pedimentos as never, {
          style: {
            color: "#b98a2f",
            weight: 2,
            dashArray: "6 4",
            fillColor: "#b98a2f",
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
          style: { color: "#7c3aed", weight: 1, fillColor: "#7c3aed", fillOpacity: 0.06 },
          onEachFeature: (f: Feature, layer) =>
            layer.on("click", () => sel("franjas", (f.properties ?? {}) as Record<string, unknown>)),
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
                html: '<div style="width:12px;height:12px;background:#dc2626;border:1.5px solid #fff;transform:rotate(45deg)"></div>',
                iconSize: [12, 12],
              }),
            }).on("click", () => sel("yacimientos", (f.properties ?? {}) as Record<string, unknown>)),
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
              color: "#7f1d1d",
              weight: 0.8,
              fillColor: "#f97316",
              fillOpacity: 0.8,
            }).on("click", () =>
              sel("geoquimica", (f.properties ?? {}) as Record<string, unknown>),
            ),
          );
        }
        groups.current.geoquimica = L.layerGroup(items).addTo(map);
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

      setReady(true);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geophysics]);

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

  // Conteo de datos reales por capa. Las capas sin datos NO se muestran en la
  // leyenda (evita el visor "recargado" con capas vacías, p.ej. geofísica en 0).
  const counts = useMemo<Record<LayerKey, number>>(
    () => ({
      tenencia: concessions?.features?.length ?? 0,
      halos: anomalies?.features?.length ?? 0,
      sondajes: drillGrid?.features?.length ?? 0,
      ensayes: assays.length,
      pedimentos: pedimentos?.features?.length ?? 0,
      franjas: franjas?.features?.length ?? 0,
      yacimientos: yacimientos?.features?.length ?? 0,
      geoquimica: geoquimica?.features?.length ?? 0,
      geofisicaProyecto: geophysicsStatus.field + geophysicsStatus.synthetic,
      magSurfaceProject: geophysicsStatus.magnetic >= 4 ? geophysicsStatus.magnetic : 0,
      ipChargeSurfaceProject: geophysicsStatus.ipCharge >= 4 ? geophysicsStatus.ipCharge : 0,
      ipResSurfaceProject: geophysicsStatus.ipRes >= 4 ? geophysicsStatus.ipRes : 0,
      // Contexto global (siempre disponible; sin conteo de features de proyecto).
      magneticaRegional: 1,
      gravedadRegional: 1,
      relieve: 1,
    }),
    [concessions, anomalies, drillGrid, assays, pedimentos, geophysicsStatus, franjas, yacimientos, geoquimica],
  );
  // Capas cuyo conteo representa nº de features (se muestra "· N"); el resto es contexto.
  const COUNTED: ReadonlyArray<LayerKey> = [
    "tenencia",
    "halos",
    "sondajes",
    "ensayes",
    "pedimentos",
    "geofisicaProyecto",
    "franjas",
    "yacimientos",
    "geoquimica",
  ];
  const visibleSections = useMemo(
    () =>
      LAYER_SECTIONS.map((s) => ({
        ...s,
        layers: s.layers.filter(([k]) => counts[k] > 0),
      })).filter((s) => s.layers.length > 0),
    [counts],
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-hairline bg-surface">
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

      <div className="relative flex" style={{ height }}>
        {/* Mapa */}
        <div ref={mapEl} className="h-full flex-1" />

        {/* Panel de capas (izquierda-flotante) — colapsable; solo secciones con datos */}
        <div className="pointer-events-auto absolute left-3 top-3 z-[500] w-56 rounded-lg border border-hairline bg-surface/95 text-[12px] shadow">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-between px-2 py-1.5 font-semibold text-content"
          >
            <span>Capas · {Object.values(visible).filter(Boolean).length} activas</span>
            <span className="text-content-subtle">{collapsed ? "▸" : "▾"}</span>
          </button>
          {!collapsed && (
            <div className="max-h-[70%] overflow-auto px-2 pb-2">
              {visibleSections.map((section, index) => (
                <div
                  key={section.title}
                  className={index > 0 ? "mt-2 border-t border-hairline pt-2" : ""}
                >
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-content">
                    {section.title}
                  </div>
                  {section.note && (
                    <div className="mb-1 px-1 text-[9px] leading-tight text-content-subtle">
                      {section.note}
                    </div>
                  )}
                  {section.title === "Geofísica" && geophysicsStatus.field > 0 && (
                    <div className="mb-1 px-1 text-[9px] leading-tight text-content-subtle">
                      CAMPO: {geophysicsStatus.field} · SIMULADO: {geophysicsStatus.synthetic}. Halo
                      requiere ≥4 puntos CAMPO por variable.
                    </div>
                  )}
                  {section.layers.map(([k, label]) => (
                    <label key={k} className="flex cursor-pointer items-start gap-2 px-1 py-0.5">
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
                          <span className="truncate">{label}</span>
                          {COUNTED.includes(k) && (
                            <span className="shrink-0 text-content-subtle">· {counts[k]}</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span
                            className="rounded px-1 text-[8px] font-bold leading-tight text-white"
                            style={{ background: EVIDENCE_BG[LAYER_META[k].evidence] }}
                          >
                            {LAYER_META[k].evidence}
                          </span>
                          <span className="text-[9px] text-content-subtle">{LAYER_META[k].scale}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              <div className="my-2 border-t border-hairline" />
              <div className="mb-1 px-1 font-semibold text-content">Base</div>
              <div className="flex gap-1 px-1">
                {(["sat", "topo"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBase(b)}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      base === b
                        ? "bg-accent-brand text-accent-brand-contrast"
                        : "border border-hairline"
                    }`}
                  >
                    {b === "sat" ? "Satélite" : "Topo"}
                  </button>
                ))}
              </div>
              {counts.halos > 0 && (
                <>
                  <div className="my-2 border-t border-hairline" />
                  <div className="mb-1 px-1 font-semibold text-content">
                    Firma espectral · Sentinel-2
                  </div>
                  {legend.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-center gap-2 px-1 py-0.5 text-[11px] text-content-muted"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: l.color }}
                      />
                      {l.label}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

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
      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold text-white"
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
    title = `Ensaye ${p.code ?? ""}`;
    prov = "certificado";
    rows = [
      ["CuT (%)", num(p.cuTotalPct)],
      ["CuS (%)", num(p.cuSolublePct)],
      ["Au (g/t)", num(p.auGpt)],
      ["Ag (ppm)", num(p.agPpm, 1)],
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
  } else {
    title = `Concesión ${p.nombre ?? ""}`;
    prov = p.es_tenencia_proyecto ? "certificado" : "contexto";
    rows = [
      ["Rol", p.rol],
      ["Titular", p.titular],
      ["Situación", p.situacion],
      ["Tipo", p.tipo],
      ["Hectáreas", p.hectareas],
      ["Comuna", p.comuna],
      ["Tenencia del proyecto", p.es_tenencia_proyecto ? "Sí" : "No (catastro oficial)"],
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
        selected.kind === "yacimientos") && (
        <div className="mt-3 rounded bg-surface-2 p-2 text-[10px] text-content-subtle">
          {selected.kind === "halos"
            ? "Detección satelital (Sentinel-2). Anomalía espectral, no identificación mineral ni extensión medida. Requiere verificación de terreno."
            : selected.kind === "sondajes"
              ? "Plataforma propuesta (conceptual). No perforada; no estima recursos ni reservas (NI 43-101)."
              : selected.kind === "geoquimica"
                ? "Geoquímica de sedimento fluvial (SERNAGEOMIN). Dispersión regional en la cuenca, NO ley in situ. Orienta, no prueba mineralización."
                : selected.kind === "yacimientos"
                  ? "Depósito conocido (SERNAGEOMIN, Minerales Críticos). Contexto de distrito; verificar distancia y sistema mineral. No implica continuidad al predio."
                  : "Propuesta de pedimento (borrador). Vacancia indicativa del catastro SERNAGEOMIN; requiere verificación legal y estudio de títulos antes de constituir. No es la solicitud oficial."}
        </div>
      )}
    </div>
  );
}
