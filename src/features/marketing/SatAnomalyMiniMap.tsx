import { useEffect, useRef } from "react";
import type { Map as MLMap, Popup as MLPopup, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";

// maplibre-gl toca `window` al importarse — cargar solo en el navegador.
let _maplibre: typeof import("maplibre-gl") | null = null;
async function loadMaplibre() {
  if (_maplibre) return _maplibre;
  const [mod] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  _maplibre = mod.default ? (mod as unknown as typeof import("maplibre-gl")) : mod;
  return _maplibre!;
}

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

const SEV_HEX: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

export type MiniMapAnomaly = {
  id: string;
  lng: number | null;
  lat: number | null;
  severity: string | null;
  index_code: string | null;
  score?: number | null;
  area_ha?: number | null;
  detected_at?: string | null;
};

function escapeHtml(s: string) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

export function SatAnomalyMiniMap({
  center,
  anomalies,
}: {
  center: [number, number] | null; // [lng, lat]
  anomalies: MiniMapAnomaly[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<MLPopup | null>(null);

  const points = anomalies.filter((a) => a.lng != null && a.lat != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!center && points.length === 0) return;
    let cancelled = false;

    loadMaplibre().then((ml) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new ml.Map({
        container: containerRef.current,
        style: STYLE,
        center: center ?? [points[0].lng!, points[0].lat!],
        zoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        pitchWithRotate: false,
      });
      map.addControl(
        new ml.NavigationControl({ visualizePitch: false, showCompass: false }),
        "top-right",
      );

      map.on("load", () => {
        const fc: FeatureCollection = {
          type: "FeatureCollection",
          features: points.map((a) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [a.lng!, a.lat!] },
            properties: {
              severity: (a.severity ?? "low").toLowerCase(),
              index_code: a.index_code ?? "",
              score: a.score ?? null,
              area_ha: a.area_ha ?? null,
              detected_at: a.detected_at ?? null,
            },
          })),
        };
        map.addSource("anomalies", { type: "geojson", data: fc });
        map.addLayer({
          id: "anomalies-halo",
          type: "circle",
          source: "anomalies",
          paint: {
            "circle-radius": 12,
            "circle-color": [
              "match",
              ["get", "severity"],
              "critical",
              SEV_HEX.critical,
              "high",
              SEV_HEX.high,
              "medium",
              SEV_HEX.medium,
              SEV_HEX.low,
            ],
            "circle-opacity": 0.18,
            "circle-blur": 0.4,
          },
        });
        map.addLayer({
          id: "anomalies-pt",
          type: "circle",
          source: "anomalies",
          paint: {
            "circle-radius": 5,
            "circle-color": [
              "match",
              ["get", "severity"],
              "critical",
              SEV_HEX.critical,
              "high",
              SEV_HEX.high,
              "medium",
              SEV_HEX.medium,
              SEV_HEX.low,
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity": 0.95,
          },
        });

        // Popup al click con detalle de la anomalía
        map.on("mouseenter", "anomalies-pt", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "anomalies-pt", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "anomalies-pt", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = (f.properties ?? {}) as {
            severity?: string;
            index_code?: string;
            score?: number | string | null;
            area_ha?: number | string | null;
            detected_at?: string | null;
          };
          const sev = (p.severity ?? "low").toLowerCase();
          const rows = [
            p.score != null && p.score !== "" ? `Score <b>${Number(p.score).toFixed(2)}</b>` : null,
            p.area_ha != null && p.area_ha !== ""
              ? `Área ${Number(p.area_ha).toFixed(1)} ha`
              : null,
            p.detected_at ? new Date(p.detected_at).toLocaleDateString("es-CL") : null,
          ].filter(Boolean);
          const html = `
            <div style="font-family:ui-sans-serif,system-ui;min-width:150px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="width:8px;height:8px;border-radius:99px;background:${SEV_HEX[sev] ?? "#94a3b8"}"></span>
                <span style="font-size:11px;font-weight:600;color:#0b2a5b">${escapeHtml(p.index_code || "Anomalía")}</span>
                <span style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(sev)}</span>
              </div>
              <div style="font-size:11px;color:#334155">${rows.map((r) => String(r)).join(" · ")}</div>
            </div>`;
          popupRef.current?.remove();
          popupRef.current = new ml.Popup({ closeButton: true, offset: 10 })
            .setLngLat((f.geometry as unknown as { coordinates: [number, number] }).coordinates)
            .setHTML(html)
            .addTo(map);
        });

        // Encuadre: puntos si hay, si no el centro del proyecto
        if (points.length > 1) {
          const lngs = points.map((p) => p.lng!);
          const lats = points.map((p) => p.lat!);
          try {
            map.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 48, duration: 0, maxZoom: 13 },
            );
          } catch {
            /* ignore */
          }
        }
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // El mapa se monta una vez por panel; los datos llegan junto con él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!center && points.length === 0) return null;

  return (
    <div className="relative rounded-lg overflow-hidden border border-hairline mb-5">
      <div ref={containerRef} className="h-56 w-full bg-surface-inverse" />
      <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 border border-white/10 px-2.5 py-1 text-[10px] font-mono text-white/80 backdrop-blur pointer-events-none">
        {points.length} anomalías georreferenciadas · Esri Imagery
      </div>
    </div>
  );
}
