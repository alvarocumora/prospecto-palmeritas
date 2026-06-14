import { useEffect, useRef, useState } from "react";
import maplibregl, {
  Map as MLMap,
  Popup,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers as LayersIcon, MapPin } from "lucide-react";
import { getOpportunitiesGeo } from "@/lib/cadastreOpportunities.functions";

type Props = {
  region?: string;
  minScore: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Imagery",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

const CHILE_CENTER: [number, number] = [-70.6, -27.5];

export function OpportunitiesMap({ region, minScore, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [layers, setLayers] = useState({
    concessions: true,
    anomalies: true,
    deposits: true,
    targets: true,
  });

  const fetchGeo = useServerFn(getOpportunitiesGeo);
  const geo = useQuery({
    queryKey: ["opp-geo", { region, minScore }],
    queryFn: () => fetchGeo({ data: { region: region || undefined, minScore, limit: 200 } }),
    staleTime: 60_000,
  });

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: CHILE_CENTER,
      zoom: 5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.on("load", () => setStyleReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // Sync data → sources/layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !geo.data) return;

    const ensureSource = (id: string, data: FeatureCollection) => {
      const src = map.getSource(id) as GeoJSONSource | undefined;
      if (src) src.setData(data);
      else map.addSource(id, { type: "geojson", data });
    };

    ensureSource("opp-concessions", geo.data.concessions);
    ensureSource("opp-anomalies", geo.data.anomalies);
    ensureSource("opp-deposits", geo.data.deposits);
    ensureSource("opp-targets", geo.data.targets);

    if (!map.getLayer("opp-concessions-fill")) {
      map.addLayer({
        id: "opp-concessions-fill",
        type: "fill",
        source: "opp-concessions",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0,
            "#64748b",
            35,
            "#94a3b8",
            50,
            "#f59e0b",
            70,
            "#10b981",
            85,
            "#059669",
          ],
          "fill-opacity": ["case", ["==", ["get", "concession_id"], selectedId ?? ""], 0.75, 0.45],
        },
      });
      map.addLayer({
        id: "opp-concessions-line",
        type: "line",
        source: "opp-concessions",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "concession_id"], selectedId ?? ""],
            "#fbbf24",
            "#0f172a",
          ],
          "line-width": ["case", ["==", ["get", "concession_id"], selectedId ?? ""], 3, 1],
        },
      });
    }
    if (!map.getLayer("opp-anomalies-pt")) {
      map.addLayer({
        id: "opp-anomalies-pt",
        type: "circle",
        source: "opp-anomalies",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ec4899",
          "circle-opacity": 0.7,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });
    }
    if (!map.getLayer("opp-deposits-pt")) {
      map.addLayer({
        id: "opp-deposits-pt",
        type: "circle",
        source: "opp-deposits",
        paint: {
          "circle-radius": 6,
          "circle-color": "#3b82f6",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }
    if (!map.getLayer("opp-targets-pt")) {
      map.addLayer({
        id: "opp-targets-pt",
        type: "circle",
        source: "opp-targets",
        paint: {
          "circle-radius": 6,
          "circle-color": "#f97316",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }

    // Fit bounds to data on first load
    const bbox = geo.data.bbox;
    if (bbox && bbox.every((n) => Number.isFinite(n))) {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 40, duration: 600, maxZoom: 11 },
      );
    }
  }, [geo.data, styleReady]);

  // Layer toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const set = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    };
    set("opp-concessions-fill", layers.concessions);
    set("opp-concessions-line", layers.concessions);
    set("opp-anomalies-pt", layers.anomalies);
    set("opp-deposits-pt", layers.deposits);
    set("opp-targets-pt", layers.targets);
  }, [layers, styleReady, geo.data]);

  // Highlight on selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (map.getLayer("opp-concessions-fill")) {
      map.setPaintProperty("opp-concessions-fill", "fill-opacity", [
        "case",
        ["==", ["get", "concession_id"], selectedId ?? ""],
        0.8,
        0.45,
      ]);
      map.setPaintProperty("opp-concessions-line", "line-color", [
        "case",
        ["==", ["get", "concession_id"], selectedId ?? ""],
        "#fbbf24",
        "#0f172a",
      ]);
      map.setPaintProperty("opp-concessions-line", "line-width", [
        "case",
        ["==", ["get", "concession_id"], selectedId ?? ""],
        3,
        1,
      ]);
    }
    // Fly to selected feature
    if (selectedId && geo.data) {
      const feat = geo.data.concessions.features.find(
        (f) => f.properties?.concession_id === selectedId,
      );
      if (feat && "coordinates" in feat.geometry) {
        try {
          const b = new maplibregl.LngLatBounds();
          const walk = (coords: unknown) => {
            if (!Array.isArray(coords)) return;
            if (typeof coords[0] === "number") b.extend(coords as [number, number]);
            else coords.forEach(walk);
          };
          walk((feat.geometry as { coordinates: unknown }).coordinates);
          map.fitBounds(b, { padding: 120, duration: 600, maxZoom: 13 });
        } catch {
          /* ignore invalid geometry */
        }
      }
    }
  }, [selectedId, styleReady, geo.data]);

  // Click handlers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, {
        layers: ["opp-concessions-fill"],
      });
      if (!feats.length) return;
      const f = feats[0];
      const p = (f.properties ?? {}) as {
        concession_id: string;
        name?: string;
        region?: string;
        commune?: string;
        score?: number;
        expiry_risk?: string;
        holder_name?: string;
        deposit_proximity_km?: number;
        anomaly_overlap_count?: number;
        ai_thesis?: string;
      };
      onSelect(p.concession_id);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 8, maxWidth: "320px" })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:system-ui;font-size:12px;line-height:1.4">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(p.name ?? "Concesión")}</div>
            <div style="color:#64748b;margin-bottom:6px">${escapeHtml(p.region ?? "")} ${p.commune ? "· " + escapeHtml(p.commune) : ""}</div>
            <div><b>Score:</b> ${p.score} · <b>Riesgo:</b> ${escapeHtml(p.expiry_risk ?? "—")}</div>
            <div><b>Titular:</b> ${escapeHtml(p.holder_name ?? "—")}</div>
            <div><b>Yacimiento:</b> ${p.deposit_proximity_km != null ? Number(p.deposit_proximity_km).toFixed(1) + " km" : "—"}</div>
            <div><b>Anomalías sat:</b> ${p.anomaly_overlap_count ?? 0}</div>
            ${p.ai_thesis ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0"><b>Tesis IA:</b> ${escapeHtml(String(p.ai_thesis).slice(0, 220))}</div>` : ""}
          </div>`,
        )
        .addTo(map);
    };
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");
    map.on("click", onClick);
    map.on("mouseenter", "opp-concessions-fill", onEnter);
    map.on("mouseleave", "opp-concessions-fill", onLeave);
    return () => {
      map.off("click", onClick);
      map.off("mouseenter", "opp-concessions-fill", onEnter);
      map.off("mouseleave", "opp-concessions-fill", onLeave);
    };
  }, [styleReady, onSelect]);

  return (
    <div className="relative w-full h-[640px] rounded-xl border overflow-hidden bg-slate-900">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Layer toggles */}
      <div className="absolute top-3 right-3 z-10 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow border p-3 text-xs space-y-2 min-w-[180px]">
        <div className="flex items-center gap-1 font-semibold text-[11px] uppercase text-muted-foreground">
          <LayersIcon className="h-3 w-3" /> Capas
        </div>
        {(
          [
            ["concessions", "Concesiones", "#10b981"],
            ["anomalies", "Anomalías sat", "#ec4899"],
            ["deposits", "Yacimientos", "#3b82f6"],
            ["targets", "Targets exploración", "#f97316"],
          ] as const
        ).map(([k, label, color]) => (
          <label key={k} className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
              {label}
            </span>
            <input
              type="checkbox"
              checked={layers[k]}
              onChange={(e) => setLayers((s) => ({ ...s, [k]: e.target.checked }))}
              className="accent-blue-600"
            />
          </label>
        ))}
        {geo.data && (
          <div className="pt-2 border-t text-[10px] text-muted-foreground">
            {geo.data.concessions.features.length} conc · {geo.data.anomalies.features.length} anom
            · {geo.data.deposits.features.length} yac · {geo.data.targets.features.length} targets
          </div>
        )}
      </div>

      {/* Legend score */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow border px-3 py-2 text-[11px]">
        <div className="font-semibold mb-1 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Score
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3" style={{ background: "#64748b" }} />
          <span className="inline-block w-4 h-3" style={{ background: "#f59e0b" }} />
          <span className="inline-block w-4 h-3" style={{ background: "#10b981" }} />
          <span className="inline-block w-4 h-3" style={{ background: "#059669" }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground w-16">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Loading / error overlays */}
      {geo.isLoading && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/50 text-white text-sm">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando capas geoespaciales…
          </span>
        </div>
      )}
      {geo.error && (
        <div className="absolute top-3 left-3 z-20 rounded bg-red-600 text-white text-xs px-3 py-2 max-w-sm">
          {(geo.error as Error).message}
        </div>
      )}
      {!geo.isLoading && !geo.error && geo.data && geo.data.concessions.features.length === 0 && (
        <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-900/95 rounded-lg border shadow px-4 py-3 text-sm text-center max-w-sm">
            Sin oportunidades en el área. Ajusta filtros o pulsa <b>Recomputar ranking</b>.
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
