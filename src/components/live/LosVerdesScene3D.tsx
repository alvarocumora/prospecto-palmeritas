// Visor 3D MapLibre para Distrito Los Verdes (Tilama).
// - DEM Terrarium real + Esri World Imagery
// - Anomalías satelitales extruidas (volumen proporcional a score)
// - Lineamientos estructurales 3D
// - Targets de exploración por prioridad
// - Halos magnéticos
// - KPIs de volumen estimado de material anómalo
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Mountain, Activity } from "lucide-react";
import type {
  PublicTarget,
  SatAnomalyPoint,
  MagAnomalyPoint,
  Lineament,
} from "@/lib/livemap-public.functions";
import type { VeinPublic, MinePlanPhasePublic } from "@/lib/losverdes-veins.functions";
import { emitLosVerdesFocus, onLosVerdesFocus } from "@/lib/losverdes-focus";

// Color por commodity individual (chips de leyenda y filtro).
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

// Parsea "Cu-Au" → ["Cu","Au"], "Au/Ag" → ["Au","Ag"], etc.
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

export function LosVerdesScene3D({
  centerLat,
  centerLng,
  satAnomalies,
  magTargets,
  lineaments,
  targets,
  veins = [],
  phases = [],
}: {
  centerLat: number;
  centerLng: number;
  satAnomalies: SatAnomalyPoint[];
  magTargets: MagAnomalyPoint[];
  lineaments: Lineament[];
  targets: PublicTarget[];
  veins?: VeinPublic[];
  phases?: MinePlanPhasePublic[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [layers, setLayers] = useState({
    sat: true,
    mag: false,
    lineaments: true,
    targets: true,
    veins: true,
    plan: true,
  });

  // KPIs de volumen aproximado: area_ha * altura(score) → m³
  const kpis = useMemo(() => {
    let totalVolM3 = 0;
    let totalAreaHa = 0;
    let high = 0;
    for (const a of satAnomalies) {
      const s = Math.max(0, Math.min(1, Number(a.score ?? 0)));
      const h = 100 + s * 600; // metros de "espesor visual"
      const areaHa = Number(a.area_ha ?? 0);
      totalAreaHa += areaHa;
      totalVolM3 += areaHa * 10000 * h; // ha→m² · h
      if (a.severity === "high") high++;
    }
    return {
      totalVolMm3: totalVolM3 / 1e6, // millones de m³
      totalAreaHa,
      highCount: high,
    };
  }, [satAnomalies]);

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
    mapRef.current = map;

    map.on("load", () => {
      // ---- Anomalías satelitales (polígonos extruidos) ----
      const satFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: satAnomalies
          .filter((a) => a.polygon && a.polygon.length >= 3)
          .map((a) => {
            const s = Math.max(0, Math.min(1, Number(a.score ?? 0)));
            const h = 100 + s * 600;
            return {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [a.polygon as [number, number][]],
              },
              properties: {
                id: a.id,
                index_code: a.index_code,
                severity: a.severity,
                score: Number(a.score ?? 0),
                area_ha: a.area_ha ?? 0,
                height: h,
                color: SEVERITY_COLOR[a.severity] ?? "#f59e0b",
              },
            } as GeoJSON.Feature;
          }),
      };
      map.addSource("sat-anom", { type: "geojson", data: satFC });
      map.addLayer({
        id: "sat-anom-extr",
        type: "fill-extrusion",
        source: "sat-anom",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
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
      const linFC: GeoJSON.FeatureCollection = {
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

      // ---- Anomalías magnéticas (halos circulares) ----
      const magFC: GeoJSON.FeatureCollection = {
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

      // ---- Targets exploración ----
      const tgtFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: targets
          .filter((t) => t.lat != null && t.lng != null)
          .map((t) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [Number(t.lng), Number(t.lat)],
            },
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

      // ---- Fases del plan de explotación (polígonos 3D) ----
      const phaseFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: phases
          .filter((p) => (p.area_polygon?.coordinates?.[0]?.length ?? 0) >= 3)
          .map((p) => ({
            type: "Feature",
            geometry: p.area_polygon as GeoJSON.Polygon,
            properties: {
              id: p.id,
              phase_no: p.phase_no,
              name: p.name,
              method: p.method,
              tonnes: p.cubication?.tonnes ?? 0,
              revenue: p.cubication?.revenueUsd ?? 0,
              npv: p.cubication?.npvUsd ?? 0,
              capex: p.cubication?.capexUsd ?? 0,
              height: Number(p.avg_thickness_m ?? 30),
              color: PHASE_COLOR[p.method ?? ""] ?? "#64748b",
            },
          })),
      };
      map.addSource("phases", { type: "geojson", data: phaseFC });
      map.addLayer({
        id: "phases-extr",
        type: "fill-extrusion",
        source: "phases",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["*", ["get", "height"], 3],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "phases-outline",
        type: "line",
        source: "phases",
        paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-dasharray": [2, 1] },
      });

      // ---- Vetas (traza superficial + cuerpo extruido en profundidad) ----
      const veinLineFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: veins
          .filter((v) => (v.geometry?.coordinates?.length ?? 0) >= 2)
          .map((v) => ({
            type: "Feature",
            geometry: v.geometry as GeoJSON.LineString,
            properties: {
              id: v.id,
              code: v.code,
              name: v.name,
              commodity: v.commodity ?? "Cu",
              strike: v.strike_deg ?? 0,
              dip: v.dip_deg ?? 75,
              thickness: v.thickness_m ?? 0,
              tonnes: v.cubication?.tonnes ?? 0,
              revenue: v.cubication?.revenueUsd ?? 0,
              color: COMMODITY_COLOR[v.commodity ?? "Cu"] ?? "#fb923c",
            },
          })),
      };
      map.addSource("veins", { type: "geojson", data: veinLineFC });
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

      // ---- Popups vetas / fases ----
      const veinPopup = new maplibregl.Popup({ closeButton: true, offset: 8 });
      map.on("click", "veins-line", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const tonnes = Number(p.tonnes ?? 0);
        const tFmt =
          tonnes >= 1e6 ? `${(tonnes / 1e6).toFixed(2)} Mt` : `${(tonnes / 1e3).toFixed(0)} kt`;
        const rev = Number(p.revenue ?? 0);
        const rFmt = rev >= 1e6 ? `$${(rev / 1e6).toFixed(1)}M` : `$${(rev / 1e3).toFixed(0)}k`;
        veinPopup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a;line-height:1.5">
              <strong>${p.code}</strong> · ${p.commodity}<br/>${p.name}<br/>
              Strike ${Number(p.strike).toFixed(0)}° · Dip ${Number(p.dip).toFixed(0)}°<br/>
              Potencia: ${Number(p.thickness).toFixed(1)} m<br/>
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
        veinPopup
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

      // ---- Popups ----
      const popup = new maplibregl.Popup({ closeButton: false });
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
              Espesor (estim): ${Number(p.height).toFixed(0)} m
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

      for (const id of ["sat-anom-extr", "targets-pt", "mag-halo"]) {
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle visibilidad sin recrear mapa
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
      setVis("phases-extr", layers.plan);
      setVis("phases-outline", layers.plan);
    };
    if (m.isStyleLoaded()) apply();
    else m.once("idle", apply);
  }, [layers]);

  // Escucha selección desde otras vistas (FieldMap) → flyTo + pulso
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

      {/* Capas */}
      <div className="absolute bottom-3 right-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1.5">
        <div className="text-gold uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Capas
        </div>
        {[
          { k: "sat" as const, label: "Anomalías SAT (3D)", color: "#f59e0b" },
          { k: "lineaments" as const, label: "Lineamientos", color: "#ef4444" },
          { k: "veins" as const, label: "Vetas Cu-Au-Ag", color: "#fb923c" },
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

      {/* Leyenda */}
      <div className="absolute bottom-3 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1">
        <div className="text-muted-foreground uppercase tracking-wider">Severidad</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#ef4444]" /> Alta
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#f59e0b]" /> Media
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#eab308]" /> Baja
        </div>
      </div>
    </div>
  );
}
