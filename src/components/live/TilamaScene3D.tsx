// Visor 3D MapLibre para el live view de Tilama.
// - DEM raster (Mapzen terrarium) para relieve real
// - Anomalías satelitales extruidas (fill-extrusion proporcional al score)
// - Polígonos de concesiones
// - Targets como círculos por prioridad
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TilamaConcession, TilamaSatAnomaly, TilamaTarget } from "@/lib/tilama.functions";

const BASE_STYLE: maplibregl.StyleSpecification = {
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
      tiles: ["/api/terrain/{z}/{x}/{y}"],
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

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};

export function TilamaScene3D({
  centerLat,
  centerLng,
  satAnomalies,
  concessions,
  targets,
}: {
  centerLat: number;
  centerLng: number;
  satAnomalies: TilamaSatAnomaly[];
  concessions: TilamaConcession[];
  targets: TilamaTarget[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: BASE_STYLE,
      center: [centerLng, centerLat],
      zoom: 12.5,
      pitch: 62,
      bearing: -25,
      maxPitch: 80,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Anomalías satelitales — extrusion proporcional al score
      const satFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: satAnomalies
          .filter((a) => a.geometry)
          .map((a) => ({
            type: "Feature",
            geometry: a.geometry as GeoJSON.Geometry,
            properties: {
              id: a.id,
              index_code: a.index_code,
              severity: (a.severity ?? "medium").toLowerCase(),
              score: Number(a.score ?? 0),
              height: 100 + Math.max(0, Math.min(1, Number(a.score ?? 0))) * 600,
            },
          })),
      };
      map.addSource("sat-anom", { type: "geojson", data: satFC });
      map.addLayer({
        id: "sat-anom-extr",
        type: "fill-extrusion",
        source: "sat-anom",
        paint: {
          "fill-extrusion-color": [
            "match",
            ["get", "severity"],
            "high",
            "#ef4444",
            "medium",
            "#f59e0b",
            "low",
            "#eab308",
            "#f59e0b",
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "sat-anom-outline",
        type: "line",
        source: "sat-anom",
        paint: { "line-color": "#fde047", "line-width": 1.2 },
      });

      // Concesiones
      const concFC: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: concessions
          .filter((c) => c.geometry_geojson)
          .map((c) => ({
            type: "Feature",
            geometry: c.geometry_geojson as GeoJSON.Geometry,
            properties: { code: c.code, name: c.name, holder: c.holder, area_ha: c.area_ha },
          })),
      };
      map.addSource("conc", { type: "geojson", data: concFC });
      map.addLayer({
        id: "conc-fill",
        type: "fill",
        source: "conc",
        paint: { "fill-color": "#22d3ee", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "conc-line",
        type: "line",
        source: "conc",
        paint: { "line-color": "#22d3ee", "line-width": 1.6, "line-dasharray": [2, 1] },
      });

      // Targets
      const tgtFC: GeoJSON.FeatureCollection = {
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
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 4, 50, 6, 100, 10],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.95,
        },
      });

      // Click popup en anomalías y targets
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true });
      map.on("click", "sat-anom-extr", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { index_code: string; severity: string; score: number };
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a"><strong>${p.index_code}</strong><br/>Severidad: ${p.severity}<br/>Score: ${Number(p.score).toFixed(2)}</div>`,
          )
          .addTo(map);
      });
      map.on("click", "targets-pt", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { code: string; name: string; priority: string; score: number };
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:11px system-ui;color:#0f172a"><strong>${p.code}</strong> · ${p.priority}<br/>${p.name}<br/>Score: ${Number(p.score).toFixed(1)}</div>`,
          )
          .addTo(map);
      });
      for (const id of ["sat-anom-extr", "targets-pt"]) {
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

  return (
    <div className="relative w-full h-[560px] rounded-lg overflow-hidden border border-border bg-bg-secondary">
      <div ref={ref} className="absolute inset-0" />
      <div className="absolute top-3 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground space-y-1 z-10">
        <div className="text-gold">GeoScene · Tilama 3D</div>
        <div>DEM real · Anomalías extruidas · Catastro</div>
      </div>
      <div className="absolute bottom-3 left-3 bg-bg-secondary/95 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono z-10 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#ef4444]" /> Anomalía alta
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#f59e0b]" /> Anomalía media
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm border border-[#22d3ee]" /> Concesión minera
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#dc2626]" /> Target crítico
        </div>
      </div>
    </div>
  );
}
