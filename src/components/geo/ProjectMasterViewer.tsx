import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Layer, GeoJSON as LeafletGeoJSON, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import { buildGeophysicsOverlays } from "@/components/map/geophysicsOverlays";

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
  | "relieve"
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
    note: "Contexto regional. No equivale a geofísica de detalle del prospecto.",
    layers: [
      ["magneticaRegional", "Anomalía magnética · EMAG2 v3"],
      ["gravedadRegional", "Anomalía Bouguer · WGM2012"],
    ],
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

export function ProjectMasterViewer({
  projectName,
  center,
  concessions,
  anomalies,
  drillGrid,
  pedimentos,
  assays = [],
  coverage,
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
    relieve: false,
    sondajes: true,
    ensayes: true,
    pedimentos: true,
  });
  const [base, setBase] = useState<"sat" | "topo">("sat");
  const [selected, setSelected] = useState<Selected>(null);

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

      // --- Geofísica pública regional. Se mantiene apagada por defecto para no
      // confundir contexto regional con evidencia de detalle del prospecto.
      const geophysics = buildGeophysicsOverlays(L);
      groups.current.magneticaRegional = geophysics["Anomalía magnética EMAG2 v3 · regional"];
      groups.current.gravedadRegional = geophysics["Anomalía Bouguer WGM2012 · regional"];
      groups.current.relieve = geophysics["Relieve / hillshade"];

      const sel = (kind: LayerKey, props: Record<string, unknown>) => setSelected({ kind, props });

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
  }, []);

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

        {/* Panel de capas (izquierda-flotante) */}
        <div className="pointer-events-auto absolute left-3 top-3 z-[500] w-56 rounded-lg border border-hairline bg-surface/95 p-2 text-[12px] shadow">
          <div className="mb-1 px-1 font-semibold text-content">Capas de evidencia</div>
          {LAYER_SECTIONS.map((section, index) => (
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
              {section.layers.map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-start gap-2 px-1 py-0.5">
                  <input
                    className="mt-0.5"
                    type="checkbox"
                    checked={visible[k]}
                    onChange={(e) => setVisible((state) => ({ ...state, [k]: e.target.checked }))}
                  />
                  <span className="text-content-muted">{label}</span>
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
          <div className="my-2 border-t border-hairline" />
          <div className="mb-1 px-1 font-semibold text-content">Firma espectral · Sentinel-2</div>
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
        selected.kind === "pedimentos") && (
        <div className="mt-3 rounded bg-surface-2 p-2 text-[10px] text-content-subtle">
          {selected.kind === "halos"
            ? "Detección satelital (Sentinel-2). Anomalía espectral, no identificación mineral ni extensión medida. Requiere verificación de terreno."
            : selected.kind === "sondajes"
              ? "Plataforma propuesta (conceptual). No perforada; no estima recursos ni reservas (NI 43-101)."
              : "Propuesta de pedimento (borrador). Vacancia indicativa del catastro SERNAGEOMIN; requiere verificación legal y estudio de títulos antes de constituir. No es la solicitud oficial."}
        </div>
      )}
    </div>
  );
}
