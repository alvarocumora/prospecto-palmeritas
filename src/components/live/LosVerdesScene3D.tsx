// Visor 3D MapLibre para Distrito Los Verdes (Tilama).
// Coherencia geológica:
//  - Anomalías SAT extruidas desde la cota real del DEM (no desde 0 msnm)
//  - Fases del plan según método: open_pit baja, underground subterránea, heap_leach arriba
//  - Vetas: traza superficial + footprint inclinado proyectado por strike/dip
// Herramientas reales (industria):
//  - Medición distancia/área con elevación (Terra Draw + DEM)
//  - Fullscreen, reset cámara, exageración configurable
//  - Coord readout (lat/lng/cota) bajo cursor
//  - Bookmarks de vista por proyecto (localStorage)
//  - Búsqueda de veta/target → flyTo
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Mountain, Activity, Bookmark, Crosshair, Search, RotateCcw, Slice } from "lucide-react";
import type {
  PublicTarget,
  SatAnomalyPoint,
  MagAnomalyPoint,
  Lineament,
} from "@/lib/livemap-public.functions";
import type { VeinPublic, MinePlanPhasePublic } from "@/lib/losverdes-veins.functions";
import type { LosVerdesDrillhole } from "@/lib/losverdes-ai.functions";
import { emitLosVerdesFocus, onLosVerdesFocus } from "@/lib/losverdes-focus";
import {
  centroid,
  polygonCentroid,
  lineMidpoint,
  veinDipFootprint,
  haversineMeters,
  lerpLngLat,
  segmentRingIntersections,
} from "@/lib/losverdes-geometry";
import {
  CrossSectionPanel,
  type SectionSample,
  type SectionVeinHit,
  type SectionPhaseHit,
} from "./CrossSectionPanel";

const COMMODITY_TOKENS = ["Au", "Ag", "Cu", "Mo"] as const;
type CommodityToken = (typeof COMMODITY_TOKENS)[number];
const COMMODITY_COLOR: Record<CommodityToken, string> = {
  Au: "#fde047",
  Ag: "#c084fc",
  Cu: "#fb923c",
  Mo: "#38bdf8",
};
const COMMODITY_LABEL: Record<CommodityToken, string> = {
  Au: "Oro",
  Ag: "Plata",
  Cu: "Cobre",
  Mo: "Molibdeno",
};

function parseCommodities(raw: string | null | undefined): CommodityToken[] {
  if (!raw) return ["Cu"];
  const tokens = raw
    .split(/[-+/,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = tokens.filter((t): t is CommodityToken =>
    (COMMODITY_TOKENS as readonly string[]).includes(t),
  );
  return out.length ? out : ["Cu"];
}

function veinColor(raw: string | null | undefined): string {
  return COMMODITY_COLOR[parseCommodities(raw)[0]];
}

const PHASE_COLOR: Record<string, string> = {
  heap_leach: "#22d3ee",
  open_pit: "#f59e0b",
  underground: "#a855f7",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};

const SEVERITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#eab308",
};

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      sat: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri World Imagery",
        maxzoom: 19,
      },
      terrain: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
      },
    },
    layers: [{ id: "sat", type: "raster", source: "sat" }],
    terrain: { source: "terrain", exaggeration: 1.6 },
    sky: {
      "sky-color": "#0a1828",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#1a2838",
      "horizon-fog-blend": 0.5,
      "fog-color": "#0a1828",
      "fog-ground-blend": 0.2,
    },
  };
}

// Tipos crudos para featureCollections internas
type FC = GeoJSON.FeatureCollection;

interface Bookmark {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

const LS_BOOKMARKS = "losverdes.bookmarks.v1";

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(LS_BOOKMARKS);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bms: Bookmark[]) {
  try {
    localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bms));
  } catch {
    /* ignore */
  }
}

export function LosVerdesScene3D({
  centerLat,
  centerLng,
  satAnomalies,
  magTargets,
  lineaments,
  targets,
  veins = [],
  phases = [],
  drillholes = [],
}: {
  centerLat: number;
  centerLng: number;
  satAnomalies: SatAnomalyPoint[];
  magTargets: MagAnomalyPoint[];
  lineaments: Lineament[];
  targets: PublicTarget[];
  veins?: VeinPublic[];
  phases?: MinePlanPhasePublic[];
  drillholes?: LosVerdesDrillhole[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  // Referencias a las FC originales (sin elev) para re-aplicar pinning a terreno
  const satFCRef = useRef<FC | null>(null);
  const phasesFCRef = useRef<FC | null>(null);
  const veinPlanesFCRef = useRef<FC | null>(null);
  const pinnedRef = useRef(false);

  const [layers, setLayers] = useState({
    sat: true,
    mag: false,
    lineaments: true,
    targets: true,
    veins: true,
    veinPlanes: true,
    plan: true,
    drills: true,
  });
  const [commoditiesOn, setCommoditiesOn] = useState<Record<CommodityToken, boolean>>({
    Au: true,
    Ag: true,
    Cu: true,
    Mo: true,
  });
  const [exag, setExag] = useState(1.6);
  const [cursor, setCursor] = useState<{ lng: number; lat: number; elev: number | null } | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  const [sectionPts, setSectionPts] = useState<[number, number][]>([]);
  const [sectionData, setSectionData] = useState<{
    samples: SectionSample[];
    veinHits: SectionVeinHit[];
    phaseHits: SectionPhaseHit[];
  } | null>(null);
  const sectionModeRef = useRef(false);
  const sectionPtsRef = useRef<[number, number][]>([]);
  useEffect(() => { sectionModeRef.current = sectionMode; }, [sectionMode]);
  useEffect(() => { sectionPtsRef.current = sectionPts; }, [sectionPts]);

  // KPIs de volumen aproximado: area_ha * altura(score) → m³
  const kpis = useMemo(() => {
    let totalVolM3 = 0;
    let totalAreaHa = 0;
    let high = 0;
    for (const a of satAnomalies) {
      const s = Math.max(0, Math.min(1, Number(a.score ?? 0)));
      const h = 100 + s * 600;
      const areaHa = Number(a.area_ha ?? 0);
      totalAreaHa += areaHa;
      totalVolM3 += areaHa * 10000 * h;
      if (a.severity === "high") high++;
    }
    return {
      totalVolMm3: totalVolM3 / 1e6,
      totalAreaHa,
      highCount: high,
    };
  }, [satAnomalies]);

  // Lista combinada para búsqueda
  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Array<{ kind: "veta" | "target"; label: string; lng: number; lat: number }>;
    const out: Array<{ kind: "veta" | "target"; label: string; lng: number; lat: number }> = [];
    for (const v of veins) {
      const lbl = `${v.code} ${v.name}`.toLowerCase();
      if (lbl.includes(q) && v.geometry?.coordinates?.length) {
        const m = lineMidpoint(v.geometry);
        if (m) out.push({ kind: "veta", label: `${v.code} · ${v.name}`, lng: m[0], lat: m[1] });
      }
    }
    for (const t of targets) {
      const lbl = `${t.code ?? ""} ${t.name ?? ""}`.toLowerCase();
      if (lbl.includes(q) && t.lat != null && t.lng != null) {
        out.push({
          kind: "target",
          label: `${t.code} · ${t.name}`,
          lng: Number(t.lng),
          lat: Number(t.lat),
        });
      }
    }
    return out.slice(0, 8);
  }, [search, veins, targets]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: buildStyle(),
      center: [centerLng, centerLat],
      zoom: 12.5,
      pitch: 62,
      bearing: -25,
      maxPitch: 80,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    mapRef.current = map;

    map.on("load", () => {
      // ---- Anomalías SAT (fill-extrusion anclado al DEM) ----
      const satFC: FC = {
        type: "FeatureCollection",
        features: satAnomalies
          .filter((a) => a.polygon && a.polygon.length >= 3)
          .map((a) => {
            const s = Math.max(0, Math.min(1, Number(a.score ?? 0)));
            const h = 100 + s * 600;
            const ring = a.polygon as [number, number][];
            const c = centroid(ring);
            return {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [ring] },
              properties: {
                id: a.id,
                index_code: a.index_code,
                severity: a.severity,
                score: Number(a.score ?? 0),
                area_ha: a.area_ha ?? 0,
                thickness: h,
                base: 0,
                top: h,
                centroid_lng: c[0],
                centroid_lat: c[1],
                color: SEVERITY_COLOR[a.severity] ?? "#f59e0b",
              },
            } as GeoJSON.Feature;
          }),
      };
      satFCRef.current = satFC;
      map.addSource("sat-anom", { type: "geojson", data: satFC });
      map.addLayer({
        id: "sat-anom-extr",
        type: "fill-extrusion",
        source: "sat-anom",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "sat-anom-outline",
        type: "line",
        source: "sat-anom",
        paint: { "line-color": "#fde047", "line-width": 1.1 },
      });

      // ---- Lineamientos estructurales ----
      const linFC: FC = {
        type: "FeatureCollection",
        features: lineaments.map((l) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: l.path.map(([lat, lng]) => [lng, lat]),
          },
          properties: {
            id: l.id,
            severity: l.severity,
            color: SEVERITY_COLOR[l.severity] ?? "#f59e0b",
          },
        })),
      };
      map.addSource("lineaments", { type: "geojson", data: linFC });
      map.addLayer({
        id: "lineaments-line",
        type: "line",
        source: "lineaments",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.4,
          "line-opacity": 0.85,
          "line-dasharray": [3, 1.5],
        },
      });

      // ---- Anomalías magnéticas (halos) ----
      const magFC: FC = {
        type: "FeatureCollection",
        features: magTargets.map((m) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [m.lng, m.lat] },
          properties: {
            id: m.id,
            name: m.name,
            mag_nt: m.mag_nt,
            rank: m.rank,
            radius_m: m.radius_m,
          },
        })),
      };
      map.addSource("mag", { type: "geojson", data: magFC });
      map.addLayer({
        id: "mag-halo",
        type: "circle",
        source: "mag",
        paint: {
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 10, 6, 16, 60],
          "circle-color": "#a855f7",
          "circle-opacity": 0.22,
          "circle-stroke-color": "#c084fc",
          "circle-stroke-width": 1.4,
        },
      });

      // ---- Targets ----
      const tgtFC: FC = {
        type: "FeatureCollection",
        features: targets
          .filter((t) => t.lat != null && t.lng != null)
          .map((t) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [Number(t.lng), Number(t.lat)] },
            properties: {
              code: t.code,
              name: t.name,
              priority: (t.priority ?? "medium").toLowerCase(),
              score: Number(t.score ?? 0),
              color: PRIORITY_COLOR[(t.priority ?? "medium").toLowerCase()] ?? "#3b82f6",
            },
          })),
      };
      map.addSource("targets", { type: "geojson", data: tgtFC });
      map.addLayer({
        id: "targets-pt",
        type: "circle",
        source: "targets",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 4, 50, 7, 100, 11],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.95,
        },
      });

      // ---- Fases del plan de explotación ----
      // base/top se calculan a partir del DEM una vez cargado.
      // Para que MapLibre acepte el extrusion, top > base; usamos thickness real.
      const phaseFC: FC = {
        type: "FeatureCollection",
        features: phases
          .filter((p) => (p.area_polygon?.coordinates?.[0]?.length ?? 0) >= 3)
          .map((p) => {
            const c = polygonCentroid(p.area_polygon) ?? [centerLng, centerLat];
            const thickness = Math.max(5, Number(p.avg_thickness_m ?? 30));
            return {
              type: "Feature",
              geometry: p.area_polygon as GeoJSON.Polygon,
              properties: {
                id: p.id,
                phase_no: p.phase_no,
                name: p.name,
                method: p.method ?? "open_pit",
                tonnes: p.cubication?.tonnes ?? 0,
                revenue: p.cubication?.revenueUsd ?? 0,
                npv: p.cubication?.npvUsd ?? 0,
                capex: p.cubication?.capexUsd ?? 0,
                thickness,
                // base/top finales en m AMSL — placeholder hasta que pinemos al DEM
                base: 0,
                top: thickness,
                centroid_lng: c[0],
                centroid_lat: c[1],
                color: PHASE_COLOR[p.method ?? ""] ?? "#64748b",
              },
            } as GeoJSON.Feature;
          }),
      };
      phasesFCRef.current = phaseFC;
      map.addSource("phases", { type: "geojson", data: phaseFC });
      map.addLayer({
        id: "phases-extr",
        type: "fill-extrusion",
        source: "phases",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-opacity": 0.42,
        },
      });
      map.addLayer({
        id: "phases-outline",
        type: "line",
        source: "phases",
        paint: { "line-color": ["get", "color"], "line-width": 1.8, "line-dasharray": [2, 1] },
      });

      // ---- Vetas: footprint inclinado (proyección strike/dip a profundidad) ----
      const planeFeatures: GeoJSON.Feature[] = [];
      for (const v of veins) {
        const trace = v.geometry?.coordinates;
        if (!trace || trace.length < 2) continue;
        const depthBottom = Number(v.depth_bottom_m ?? 0);
        if (depthBottom <= 0) continue;
        const ring = veinDipFootprint({
          trace,
          dip_deg: Number(v.dip_deg ?? 75),
          dip_dir_deg: Number(v.dip_dir_deg ?? 90),
          depth_bottom_m: depthBottom,
        });
        if (!ring) continue;
        const toks = parseCommodities(v.commodity);
        planeFeatures.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: ring },
          properties: {
            id: v.id,
            code: v.code,
            name: v.name,
            commodity: v.commodity ?? "Cu",
            has_au: toks.includes("Au"),
            has_ag: toks.includes("Ag"),
            has_cu: toks.includes("Cu"),
            has_mo: toks.includes("Mo"),
            depth_top: Number(v.depth_top_m ?? 0),
            depth_bottom: depthBottom,
            color: veinColor(v.commodity),
          },
        });
      }
      const veinPlaneFC: FC = { type: "FeatureCollection", features: planeFeatures };
      veinPlanesFCRef.current = veinPlaneFC;
      map.addSource("vein-planes", { type: "geojson", data: veinPlaneFC });
      map.addLayer({
        id: "vein-planes-fill",
        type: "fill",
        source: "vein-planes",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "vein-planes-outline",
        type: "line",
        source: "vein-planes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.2,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.7,
        },
      });

      // ---- Vetas: traza superficial ----
      const veinLineFC: FC = {
        type: "FeatureCollection",
        features: veins
          .filter((v) => (v.geometry?.coordinates?.length ?? 0) >= 2)
          .map((v) => {
            const toks = parseCommodities(v.commodity);
            return {
              type: "Feature",
              geometry: v.geometry as GeoJSON.LineString,
              properties: {
                id: v.id,
                code: v.code,
                name: v.name,
                commodity: v.commodity ?? "Cu",
                has_au: toks.includes("Au"),
                has_ag: toks.includes("Ag"),
                has_cu: toks.includes("Cu"),
                has_mo: toks.includes("Mo"),
                strike: v.strike_deg ?? 0,
                dip: v.dip_deg ?? 75,
                thickness: v.thickness_m ?? 0,
                depth_top: v.depth_top_m ?? 0,
                depth_bottom: v.depth_bottom_m ?? 0,
                tonnes: v.cubication?.tonnes ?? 0,
                revenue: v.cubication?.revenueUsd ?? 0,
                color: veinColor(v.commodity),
              },
            };
          }),
      };
      map.addSource("veins", { type: "geojson", data: veinLineFC });
      map.addLayer({
        id: "veins-glow",
        type: "line",
        source: "veins",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 9,
          "line-opacity": 0.18,
          "line-blur": 4,
        },
      });
      map.addLayer({
        id: "veins-line",
        type: "line",
        source: "veins",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3.2,
          "line-opacity": 0.95,
        },
      });

      // ---- Popups ----
      const popup = new maplibregl.Popup({ closeButton: true, offset: 8 });
      map.on("click", "veins-line", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const tonnes = Number(p.tonnes ?? 0);
        const tFmt =
          tonnes >= 1e6 ? `${(tonnes / 1e6).toFixed(2)} Mt` : `${(tonnes / 1e3).toFixed(0)} kt`;
        const rev = Number(p.revenue ?? 0);
        const rFmt = rev >= 1e6 ? `$${(rev / 1e6).toFixed(1)}M` : `$${(rev / 1e3).toFixed(0)}k`;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>${p.code}</strong> · ${p.commodity}<br/>${p.name}<br/>
              Strike ${Number(p.strike).toFixed(0)}° · Dip ${Number(p.dip).toFixed(0)}°<br/>
              Potencia: ${Number(p.thickness).toFixed(1)} m<br/>
              Profundidad: ${Number(p.depth_top).toFixed(0)}–${Number(p.depth_bottom).toFixed(0)} m<br/>
              Recurso conceptual: <b>${tFmt}</b><br/>
              In-situ value: <b>${rFmt}</b>
            </div>`,
          )
          .addTo(map);
        emitLosVerdesFocus({
          kind: "target",
          id: String(p.code ?? ""),
          label: String(p.name ?? ""),
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          source: "scene3d",
        });
      });
      map.on("click", "phases-extr", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const tonnes = Number(p.tonnes ?? 0);
        const tFmt =
          tonnes >= 1e6 ? `${(tonnes / 1e6).toFixed(2)} Mt` : `${(tonnes / 1e3).toFixed(0)} kt`;
        const npv = Number(p.npv ?? 0);
        const npvFmt = `${npv < 0 ? "-" : ""}$${(Math.abs(npv) / 1e6).toFixed(1)}M`;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>F${p.phase_no} · ${p.method}</strong><br/>${p.name}<br/>
              Tonelaje: <b>${tFmt}</b><br/>
              CAPEX: $${(Number(p.capex) / 1e6).toFixed(0)}M<br/>
              NPV @8%: <b style="color:${npv > 0 ? "#059669" : "#dc2626"}">${npvFmt}</b>
            </div>`,
          )
          .addTo(map);
      });
      map.on("click", "sat-anom-extr", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>${p.index_code}</strong><br/>
              Severidad: <b>${p.severity}</b><br/>
              Score: ${Number(p.score).toFixed(2)}<br/>
              Área: ${Number(p.area_ha).toFixed(1)} ha<br/>
              Espesor: ${Number(p.thickness).toFixed(0)} m<br/>
              Base: ${Number(p.base).toFixed(0)} m AMSL
            </div>`,
          )
          .addTo(map);
        emitLosVerdesFocus({
          kind: "sat",
          id: String(p.id ?? p.index_code ?? ""),
          label: String(p.index_code ?? ""),
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          source: "scene3d",
        });
      });
      map.on("click", "targets-pt", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>${p.code}</strong> · ${p.priority}<br/>${p.name}<br/>
              Score: ${Number(p.score).toFixed(1)}
            </div>`,
          )
          .addTo(map);
        emitLosVerdesFocus({
          kind: "target",
          id: String(p.code ?? ""),
          label: String(p.name ?? p.code ?? ""),
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          source: "scene3d",
        });
      });
      map.on("click", "mag-halo", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>MAG · ${p.name}</strong><br/>
              ΔT: ${Number(p.mag_nt).toFixed(1)} nT<br/>
              Rango: #${p.rank}
            </div>`,
          )
          .addTo(map);
        emitLosVerdesFocus({
          kind: "mag",
          id: String(p.id ?? p.name ?? ""),
          label: String(p.name ?? ""),
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          source: "scene3d",
        });
      });

      for (const id of [
        "sat-anom-extr",
        "targets-pt",
        "mag-halo",
        "veins-line",
        "phases-extr",
      ]) {
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }

      // ---- Capa de línea de sección ----
      map.addSource("section-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "section-line-l",
        type: "line",
        source: "section-line",
        paint: { "line-color": "#fde047", "line-width": 3, "line-dasharray": [2, 1] },
      });
      map.addLayer({
        id: "section-line-pts",
        type: "circle",
        source: "section-line",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#fde047",
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1.5,
        },
      });

      // ---- Click handler para sección (captura A y B) ----
      map.on("click", (e) => {
        if (!sectionModeRef.current) return;
        const cur = sectionPtsRef.current;
        const next: [number, number][] = cur.length >= 2
          ? [[e.lngLat.lng, e.lngLat.lat]]
          : [...cur, [e.lngLat.lng, e.lngLat.lat]];
        setSectionPts(next);
      });

      // ---- Mousemove → coord readout ----
      map.on("mousemove", (e) => {
        const elev = map.queryTerrainElevation
          ? (map.queryTerrainElevation(e.lngLat) ?? null)
          : null;
        setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat, elev });
      });
      map.on("mouseout", () => setCursor(null));

      // ---- Pin de fill-extrusion al DEM ----
      // El DEM tarda en cargar; intentamos en `idle` y reintentamos al evento
      // `sourcedata` del raster-dem hasta tener un elevation finito.
      const pin = () => {
        if (pinnedRef.current) return;
        // Comprobación con un sondeo en el centro
        const probe = map.queryTerrainElevation([centerLng, centerLat]);
        if (probe == null || !isFinite(probe)) return;
        pinnedRef.current = true;

        // Sat anomalías: base = elev_centroide, top = base + thickness
        const sat = satFCRef.current;
        if (sat) {
          for (const f of sat.features) {
            const lng = Number(f.properties?.centroid_lng);
            const lat = Number(f.properties?.centroid_lat);
            const elev = map.queryTerrainElevation([lng, lat]) ?? 0;
            const th = Number(f.properties?.thickness ?? 200);
            f.properties = { ...f.properties, base: Math.max(0, elev), top: Math.max(0, elev) + th };
          }
          (map.getSource("sat-anom") as maplibregl.GeoJSONSource).setData(sat);
        }

        // Fases: base/top según método
        const ph = phasesFCRef.current;
        if (ph) {
          for (const f of ph.features) {
            const lng = Number(f.properties?.centroid_lng);
            const lat = Number(f.properties?.centroid_lat);
            const elev = map.queryTerrainElevation([lng, lat]) ?? 0;
            const th = Number(f.properties?.thickness ?? 30);
            const method = String(f.properties?.method ?? "open_pit");
            let base = elev;
            let top = elev + th;
            if (method === "open_pit") {
              base = Math.max(0, elev - th);
              top = elev;
            } else if (method === "underground") {
              base = Math.max(0, elev - (th + 50));
              top = Math.max(5, elev - 50);
            } else {
              base = elev;
              top = elev + th;
            }
            if (top <= base) top = base + 5;
            f.properties = { ...f.properties, base, top };
          }
          (map.getSource("phases") as maplibregl.GeoJSONSource).setData(ph);
        }
      };
      map.on("idle", pin);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      pinnedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle visibilidad + filtro de commodities
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      const setVis = (id: string, v: boolean) => {
        if (!m.getLayer(id)) return;
        m.setLayoutProperty(id, "visibility", v ? "visible" : "none");
      };
      setVis("sat-anom-extr", layers.sat);
      setVis("sat-anom-outline", layers.sat);
      setVis("lineaments-line", layers.lineaments);
      setVis("mag-halo", layers.mag);
      setVis("targets-pt", layers.targets);
      setVis("veins-line", layers.veins);
      setVis("veins-glow", layers.veins);
      setVis("vein-planes-fill", layers.veinPlanes);
      setVis("vein-planes-outline", layers.veinPlanes);
      setVis("phases-extr", layers.plan);
      setVis("phases-outline", layers.plan);

      const enabled = (COMMODITY_TOKENS as readonly CommodityToken[]).filter(
        (c) => commoditiesOn[c],
      );
      const veinFilter: maplibregl.FilterSpecification = enabled.length
        ? [
            "any",
            ...enabled.map(
              (c) =>
                ["==", ["get", `has_${c.toLowerCase()}`], true] as maplibregl.ExpressionSpecification,
            ),
          ]
        : ["==", ["literal", 1], ["literal", 0]];
      for (const id of ["veins-line", "veins-glow", "vein-planes-fill", "vein-planes-outline"]) {
        if (m.getLayer(id)) m.setFilter(id, veinFilter);
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [layers, commoditiesOn]);

  // Exageración del terreno
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      try {
        m.setTerrain({ source: "terrain", exaggeration: exag });
      } catch {
        /* ignore */
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [exag]);

  // Cursor crosshair cuando sectionMode activo
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.getCanvas().style.cursor = sectionMode ? "crosshair" : "";
  }, [sectionMode]);

  // Refleja sectionPts en la capa + calcula perfil cuando hay A-B
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource("section-line") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = sectionPts.map((pt) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: pt },
      properties: {},
    }));
    if (sectionPts.length === 2) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: sectionPts },
        properties: {},
      });
    }
    src.setData({ type: "FeatureCollection", features });

    if (sectionPts.length !== 2) {
      setSectionData(null);
      return;
    }
    const [A, B] = sectionPts as [[number, number], [number, number]];
    const totalDist = haversineMeters(A, B);
    const N = 160;
    const samples: SectionSample[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const pt = lerpLngLat(A, B, t);
      const e = m.queryTerrainElevation
        ? (m.queryTerrainElevation({ lng: pt[0], lat: pt[1] }) ?? 0)
        : 0;
      samples.push({ dist_m: totalDist * t, elev_m: e });
    }

    // Función distancia a lo largo de A-B para un punto cualquiera (proyección).
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy || 1;
    const projDist = (pt: [number, number]) => {
      const t = ((pt[0] - A[0]) * dx + (pt[1] - A[1]) * dy) / len2;
      const tt = Math.max(0, Math.min(1, t));
      return tt * totalDist;
    };

    // Vetas: usamos la TRAZA superficial (LineString) — intersección 1D con A-B.
    const veinHits: SectionVeinHit[] = [];
    for (const v of veins) {
      const trace = v.geometry?.coordinates;
      if (!trace || trace.length < 2) continue;
      for (let i = 0; i < trace.length - 1; i++) {
        const p1 = trace[i] as [number, number];
        const p2 = trace[i + 1] as [number, number];
        // segmentIntersect reusado
        const x1 = A[0], y1 = A[1], x2 = B[0], y2 = B[1];
        const x3 = p1[0], y3 = p1[1], x4 = p2[0], y4 = p2[1];
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-12) continue;
        const tA = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
        if (tA < 0 || tA > 1 || u < 0 || u > 1) continue;
        const ix: [number, number] = [x1 + tA * (x2 - x1), y1 + tA * (y2 - y1)];
        const surf = m.queryTerrainElevation
          ? (m.queryTerrainElevation({ lng: ix[0], lat: ix[1] }) ?? 0)
          : 0;
        veinHits.push({
          vein_code: v.code,
          vein_name: v.name,
          commodity: v.commodity ?? "Cu",
          color: veinColor(v.commodity),
          dist_m: tA * totalDist,
          surface_elev_m: surf,
          depth_top_m: Number(v.depth_top_m ?? 0),
          depth_bottom_m: Number(v.depth_bottom_m ?? 100),
        });
        break;
      }
    }

    // Fases: intersección segmento-polígono → entrada/salida.
    const phaseHits: SectionPhaseHit[] = [];
    for (const p of phases) {
      const ring = p.area_polygon?.coordinates?.[0] as [number, number][] | undefined;
      if (!ring || ring.length < 4) continue;
      const ints = segmentRingIntersections(A, B, ring);
      if (ints.length < 2) continue;
      const dists = ints.map(projDist).sort((a, b) => a - b);
      const c = polygonCentroid(p.area_polygon);
      const elev = c && m.queryTerrainElevation
        ? (m.queryTerrainElevation({ lng: c[0], lat: c[1] }) ?? 0)
        : 0;
      const th = Math.max(5, Number(p.avg_thickness_m ?? 30));
      const method = p.method ?? "open_pit";
      let base = elev, top = elev + th;
      if (method === "open_pit") { base = elev - th; top = elev; }
      else if (method === "underground") { base = elev - (th + 50); top = elev - 50; }
      phaseHits.push({
        phase_no: p.phase_no,
        name: p.name,
        method,
        color: PHASE_COLOR[method] ?? "#64748b",
        dist_m_in: dists[0],
        dist_m_out: dists[dists.length - 1],
        base_m: base,
        top_m: top,
      });
    }

    setSectionData({ samples, veinHits, phaseHits });
  }, [sectionPts, veins, phases]);

  // Escucha selección desde otras vistas (FieldMap) → flyTo
  useEffect(() => {
    const off = onLosVerdesFocus((d) => {
      if (d.source === "scene3d") return;
      const m = mapRef.current;
      if (!m) return;
      m.flyTo({ center: [d.lng, d.lat], zoom: 14.5, pitch: 62, speed: 1.2 });
      const popup = new maplibregl.Popup({ closeButton: true, offset: 12 })
        .setLngLat([d.lng, d.lat])
        .setHTML(
          `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
            <strong>${d.kind.toUpperCase()}</strong><br/>${d.label ?? d.id}
          </div>`,
        )
        .addTo(m);
      window.setTimeout(() => popup.remove(), 4000);
    });
    return off;
  }, []);

  // Handlers UI
  const resetCamera = () => {
    mapRef.current?.easeTo({
      center: [centerLng, centerLat],
      zoom: 12.5,
      pitch: 62,
      bearing: -25,
      duration: 900,
    });
  };

  const saveBookmark = () => {
    const m = mapRef.current;
    if (!m) return;
    const name = window.prompt("Nombre del bookmark:", `Vista ${bookmarks.length + 1}`);
    if (!name) return;
    const c = m.getCenter();
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      name,
      center: [c.lng, c.lat],
      zoom: m.getZoom(),
      pitch: m.getPitch(),
      bearing: m.getBearing(),
    };
    const next = [...bookmarks, bm];
    setBookmarks(next);
    saveBookmarks(next);
  };

  const goBookmark = (bm: Bookmark) => {
    mapRef.current?.easeTo({
      center: bm.center,
      zoom: bm.zoom,
      pitch: bm.pitch,
      bearing: bm.bearing,
      duration: 900,
    });
  };

  const removeBookmark = (id: string) => {
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarks(next);
    saveBookmarks(next);
  };

  const flyToHit = (lng: number, lat: number, label: string, kind: "veta" | "target") => {
    const m = mapRef.current;
    if (!m) return;
    m.flyTo({ center: [lng, lat], zoom: 15, pitch: 62, speed: 1.2 });
    setSearch("");
    setSearchOpen(false);
    emitLosVerdesFocus({
      kind: kind === "veta" ? "target" : "target",
      id: label,
      label,
      lat,
      lng,
      source: "scene3d",
    });
  };

  return (
    <div className="relative w-full h-[640px] rounded-lg overflow-hidden border border-border bg-bg-secondary">
      <div ref={ref} className="absolute inset-0" />

      {/* Header info */}
      <div className="absolute top-3 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground space-y-1 z-10 max-w-[260px]">
        <div className="text-gold flex items-center gap-1.5">
          <Mountain className="w-3 h-3" /> GeoScene · Los Verdes 3D
        </div>
        <div>Esri Imagery · DEM Terrarium · Volúmenes</div>
      </div>

      {/* KPIs volumen */}
      <div className="absolute top-3 right-14 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1">
        <div className="text-gold uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Volumen anómalo (est.)
        </div>
        <div>
          <span className="text-muted-foreground">Total:</span>{" "}
          <b className="text-foreground">{kpis.totalVolMm3.toFixed(1)} Mm³</b>
        </div>
        <div>
          <span className="text-muted-foreground">Área:</span>{" "}
          <b className="text-foreground">{kpis.totalAreaHa.toFixed(0)} ha</b>
        </div>
        <div>
          <span className="text-muted-foreground">Anom. altas:</span>{" "}
          <b className="text-rose-400">{kpis.highCount}</b>
        </div>
      </div>

      {/* Toolbar central (búsqueda + cámara + bookmarks) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            title="Buscar veta/target"
            className="bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1.5 text-[11px] flex items-center gap-1.5 hover:border-gold/50"
          >
            <Search className="w-3.5 h-3.5" /> Buscar
          </button>
          {searchOpen && (
            <div className="absolute top-full mt-1 left-0 w-[260px] bg-bg-secondary/98 backdrop-blur border border-border rounded p-2 shadow-lg">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código o nombre…"
                className="w-full bg-transparent border border-border rounded px-2 py-1 text-[11px] outline-none focus:border-gold/60"
              />
              {searchHits.length > 0 && (
                <ul className="mt-1 max-h-[200px] overflow-auto text-[11px]">
                  {searchHits.map((h, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => flyToHit(h.lng, h.lat, h.label, h.kind)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-bg-primary/60"
                      >
                        <span className="text-muted-foreground uppercase text-[9px] mr-1">
                          {h.kind}
                        </span>
                        {h.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={resetCamera}
          title="Reset cámara"
          className="bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1.5 text-[11px] flex items-center gap-1.5 hover:border-gold/50"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <button
          type="button"
          onClick={saveBookmark}
          title="Guardar vista"
          className="bg-bg-secondary/95 backdrop-blur border border-border rounded px-2 py-1.5 text-[11px] flex items-center gap-1.5 hover:border-gold/50"
        >
          <Bookmark className="w-3.5 h-3.5" /> Guardar
        </button>
        <button
          type="button"
          onClick={() => {
            setSectionMode((v) => {
              const next = !v;
              if (!next) { setSectionPts([]); setSectionData(null); }
              return next;
            });
          }}
          title="Sección transversal (clic A, clic B)"
          className={`backdrop-blur border rounded px-2 py-1.5 text-[11px] flex items-center gap-1.5 ${
            sectionMode
              ? "bg-gold/20 border-gold text-gold"
              : "bg-bg-secondary/95 border-border hover:border-gold/50"
          }`}
        >
          <Slice className="w-3.5 h-3.5" /> Sección {sectionMode ? `(${sectionPts.length}/2)` : ""}
        </button>
      </div>

      {sectionData && (
        <CrossSectionPanel
          samples={sectionData.samples}
          veinHits={sectionData.veinHits}
          phaseHits={sectionData.phaseHits}
          onClose={() => { setSectionPts([]); setSectionData(null); setSectionMode(false); }}
        />
      )}

      {/* Exageración + readout cursor */}
      <div className="absolute bottom-16 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1.5 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mountain className="w-3 h-3 text-gold" />
          <span className="text-muted-foreground">Exag DEM</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={exag}
            onChange={(e) => setExag(Number(e.target.value))}
            className="flex-1 accent-gold"
          />
          <span className="text-foreground tabular-nums">{exag.toFixed(1)}×</span>
        </div>
        <div className="flex items-center gap-2 border-t border-border/60 pt-1.5">
          <Crosshair className="w-3 h-3 text-gold" />
          {cursor ? (
            <span className="tabular-nums text-foreground">
              {cursor.lat.toFixed(4)}, {cursor.lng.toFixed(4)}
              {cursor.elev != null && (
                <span className="text-muted-foreground"> · {cursor.elev.toFixed(0)} m</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">— · — · —</span>
          )}
        </div>
      </div>

      {/* Capas */}
      <div className="absolute bottom-3 right-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1.5">
        <div className="text-gold uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Capas
        </div>
        {[
          { k: "sat" as const, label: "Anomalías SAT (3D)", color: "#f59e0b" },
          { k: "lineaments" as const, label: "Lineamientos", color: "#ef4444" },
          { k: "veins" as const, label: "Vetas (traza)", color: "#fb923c" },
          { k: "veinPlanes" as const, label: "Vetas (footprint dip)", color: "#fbbf24" },
          { k: "plan" as const, label: "Fases de explotación", color: "#22d3ee" },
          { k: "mag" as const, label: "Magnéticas", color: "#a855f7" },
          { k: "targets" as const, label: "Targets", color: "#dc2626" },
        ].map((row) => (
          <label key={row.k} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={layers[row.k]}
              onChange={(e) => setLayers((p) => ({ ...p, [row.k]: e.target.checked }))}
              className="accent-gold w-3 h-3"
            />
            <span className="w-3 h-3 rounded-sm" style={{ background: row.color }} />
            <span>{row.label}</span>
          </label>
        ))}
      </div>

      {/* Leyenda commodities + Bookmarks */}
      <div className="absolute bottom-3 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-2 max-w-[260px]">
        <div>
          <div className="text-gold uppercase tracking-wider mb-1">Vetas por commodity</div>
          <div className="flex flex-wrap gap-1.5">
            {COMMODITY_TOKENS.map((c) => {
              const on = commoditiesOn[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCommoditiesOn((p) => ({ ...p, [c]: !p[c] }))}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-colors"
                  style={{
                    borderColor: on ? COMMODITY_COLOR[c] : "rgba(148,163,184,0.3)",
                    background: on ? `${COMMODITY_COLOR[c]}22` : "transparent",
                    opacity: on ? 1 : 0.45,
                  }}
                  title={`${COMMODITY_LABEL[c]} (${c})`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: COMMODITY_COLOR[c] }}
                  />
                  <span className="text-foreground">{c}</span>
                </button>
              );
            })}
          </div>
        </div>
        {bookmarks.length > 0 && (
          <div className="border-t border-border/60 pt-1.5">
            <div className="text-muted-foreground uppercase tracking-wider mb-1">Bookmarks</div>
            <ul className="space-y-0.5 max-h-[110px] overflow-auto">
              {bookmarks.map((bm) => (
                <li key={bm.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goBookmark(bm)}
                    className="flex-1 text-left px-1.5 py-0.5 rounded hover:bg-bg-primary/60 truncate"
                    title={bm.name}
                  >
                    {bm.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBookmark(bm.id)}
                    className="text-muted-foreground hover:text-rose-400 px-1"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
