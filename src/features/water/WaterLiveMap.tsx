/**
 * Live map de derechos de agua. Client-only: Leaflet se carga dinámicamente.
 * Marcadores circulares escalados por caudal permanente, capas de portafolio,
 * radios de análisis y basemaps satélite / terreno / calles / hidrología.
 */
import { useEffect, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LMap, TileLayer } from "leaflet";
import { Layers, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCLP, fmtFlow, type WaterAsset, type WaterPortfolio } from "./data";

export type BasemapKey = "satellite" | "terrain" | "streets" | "hydrology";

const BASEMAPS: Record<
  BasemapKey,
  { label: string; url: string; attribution: string; overlay?: string }
> = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
    overlay:
      "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  },
  terrain: {
    label: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, DeLorme, NAVTEQ",
  },
  streets: {
    label: "Streets",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap © CARTO",
  },
  hydrology: {
    label: "Hydrology",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC-BY-SA), SRTM",
    overlay:
      "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}",
  },
};

const RADII = [5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADII)[number];

const OVERLAYS = {
  transport: {
    label: "Rutas e infraestructura",
    url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  },
  places: {
    label: "Ciudades y límites",
    url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  },
  hydro: {
    label: "Red hidrográfica",
    url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Hydro_Reference_Overlay/MapServer/tile/{z}/{y}/{x}",
  },
} as const;
type OverlayKey = keyof typeof OVERLAYS;

function markerHtml(asset: WaterAsset, color: string, precise: boolean) {
  const base = 44;
  const size = Math.round(base * (asset.flow_permanent_ls / 1000));
  const d = Math.max(34, size);
  const label = new Intl.NumberFormat("en-US").format(asset.flow_permanent_ls);
  return `
  <div style="position:relative;width:${d}px;height:${d}px;transform:translate(-50%,-50%)">
    <div style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.18"></div>
    <div style="position:absolute;inset:${precise ? 5 : 8}px;border-radius:9999px;background:${color};opacity:${precise ? 0.95 : 0.7};border:2px solid rgba(255,255,255,.9);box-shadow:0 6px 18px rgba(2,20,48,.45);display:flex;align-items:center;justify-content:center">
      <span style="font:600 ${d > 44 ? 10 : 9}px/1 Inter,system-ui,sans-serif;color:#fff;letter-spacing:.02em">${label}</span>
    </div>
  </div>`;
}

export function WaterLiveMap({
  assets,
  portfolios,
  activePortfolios,
  selectedId,
  onSelect,
  mode,
  className,
  height = "100%",
}: {
  assets: WaterAsset[];
  portfolios: WaterPortfolio[];
  activePortfolios: string[];
  selectedId: string | null;
  onSelect: (assetUuid: string) => void;
  /** public = ubicación aproximada; investor = coordenada precisa */
  mode: "public" | "investor";
  className?: string;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const baseRef = useRef<TileLayer[]>([]);
  const overlayRef = useRef<Partial<Record<OverlayKey, TileLayer>>>({});
  const markersRef = useRef<LayerGroup | null>(null);
  const circlesRef = useRef<LayerGroup | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>("satellite");
  const [radius, setRadius] = useState<RadiusKm | null>(null);
  const [overlays, setOverlays] = useState<OverlayKey[]>([]);
  const [panel, setPanel] = useState<"layers" | "radius" | null>(null);

  // init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: L }] = await Promise.all([
        import("leaflet"),
        import("leaflet/dist/leaflet.css"),
      ]);
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(
        [-40.62, -73.76],
        10,
      );
      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      circlesRef.current = L.layerGroup().addTo(map);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // basemap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      baseRef.current.forEach((l) => map.removeLayer(l));
      baseRef.current = [];
      const cfg = BASEMAPS[basemap];
      const base = L.tileLayer(cfg.url, {
        maxZoom: 18,
        attribution: cfg.attribution,
        subdomains: "abcd",
      });
      base.addTo(map);
      base.bringToBack();
      baseRef.current.push(base);
      if (cfg.overlay) {
        const ov = L.tileLayer(cfg.overlay, { maxZoom: 18, opacity: 0.85 });
        ov.addTo(map);
        baseRef.current.push(ov);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basemap]);

  // intelligence overlays
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      (Object.keys(OVERLAYS) as OverlayKey[]).forEach((k) => {
        const on = overlays.includes(k);
        const existing = overlayRef.current[k];
        if (on && !existing) {
          const l = L.tileLayer(OVERLAYS[k].url, { maxZoom: 18, opacity: 0.9 }).addTo(map);
          overlayRef.current[k] = l;
        } else if (!on && existing) {
          map.removeLayer(existing);
          delete overlayRef.current[k];
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [overlays]);

  // markers + radios
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: L } = await import("leaflet");
      const map = mapRef.current;
      const layer = markersRef.current;
      const circles = circlesRef.current;
      if (cancelled || !map || !layer || !circles) return;
      layer.clearLayers();
      circles.clearLayers();

      const colorFor = (a: WaterAsset) => {
        const p = portfolios.find((pf) => pf.assetUuids.includes(a.id));
        return p?.color ?? "#0ea5e9";
      };

      const visible = assets.filter((a) => {
        const p = portfolios.find((pf) => pf.assetUuids.includes(a.id));
        if (!p) return true;
        return activePortfolios.includes(p.id);
      });

      const pts: [number, number][] = [];
      for (const a of visible) {
        const color = colorFor(a);
        // Modo público: se jitterea ~700 m para entregar ubicación aproximada.
        const jitter = mode === "public" ? 0.006 : 0;
        const lat = a.latitude + (jitter ? jitter * Math.sin(a.latitude * 97) : 0);
        const lng = a.longitude + (jitter ? jitter * Math.cos(a.longitude * 89) : 0);
        pts.push([lat, lng]);

        if (radius) {
          const c: Circle = L.circle([lat, lng], {
            radius: radius * 1000,
            color,
            weight: 1,
            opacity: 0.6,
            fillColor: color,
            fillOpacity: 0.06,
          });
          circles.addLayer(c);
        }

        const icon = L.divIcon({
          className: "",
          html: markerHtml(a, color, mode === "investor"),
          iconSize: [0, 0],
        });
        const m = L.marker([lat, lng], { icon, riseOnHover: true });
        m.bindTooltip(
          `<div style="font:500 11px/1.45 Inter,system-ui,sans-serif;color:#0f172a">
             <div style="font-weight:700;letter-spacing:.06em;font-size:9px;color:#0369a1">${a.asset_id}</div>
             <div style="font-weight:600;margin-top:2px">${a.river}</div>
             <div>${fmtFlow(a.flow_permanent_ls)} · ${a.nature === "consuntivo" ? "Consumptive" : "Non-consumptive"}</div>
             <div style="color:#334155">${fmtCLP(a.reference_value_clp)}</div>
           </div>`,
          { direction: "top", offset: [0, -22], opacity: 1 },
        );
        m.on("click", () => onSelect(a.id));
        layer.addLayer(m);
      }

      if (pts.length && !selectedId) {
        map.fitBounds(L.latLngBounds(pts).pad(0.35), { animate: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, portfolios, activePortfolios, radius, mode, selectedId, onSelect]);

  // fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const a = assets.find((x) => x.id === selectedId);
    if (!a) return;
    map.flyTo([a.latitude, a.longitude], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [selectedId, assets]);

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <div ref={containerRef} className="absolute inset-0 rounded-lg overflow-hidden" />

      {/* Basemap switch */}
      <div className="absolute top-3 left-14 z-[500] flex rounded-md overflow-hidden border border-white/15 bg-[#04122a]/85 backdrop-blur">
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setBasemap(k)}
            className={cn(
              "px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
              basemap === k ? "bg-sky-500 text-white" : "text-sky-100/70 hover:text-white",
            )}
          >
            {BASEMAPS[k].label}
          </button>
        ))}
      </div>

      {/* Controles derecha */}
      <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPanel(panel === "layers" ? null : "layers")}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#04122a]/85 px-2.5 py-1.5 text-[11px] text-sky-100 backdrop-blur hover:text-white"
          >
            <Layers className="w-3.5 h-3.5" /> Capas
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "radius" ? null : "radius")}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#04122a]/85 px-2.5 py-1.5 text-[11px] text-sky-100 backdrop-blur hover:text-white"
          >
            <Radar className="w-3.5 h-3.5" /> Radio {radius ? `${radius} km` : ""}
          </button>
        </div>

        {panel === "layers" && (
          <div className="w-56 rounded-md border border-white/15 bg-[#04122a]/92 p-3 text-sky-100 backdrop-blur">
            <div className="text-[9px] uppercase tracking-[0.18em] text-sky-300/70 mb-2">
              Map Intelligence
            </div>
            {(Object.keys(OVERLAYS) as OverlayKey[]).map((k) => (
              <label key={k} className="flex items-center gap-2 py-1 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-sky-400"
                  checked={overlays.includes(k)}
                  onChange={(e) =>
                    setOverlays((prev) =>
                      e.target.checked ? [...prev, k] : prev.filter((x) => x !== k),
                    )
                  }
                />
                {OVERLAYS[k].label}
              </label>
            ))}
          </div>
        )}

        {panel === "radius" && (
          <div className="w-44 rounded-md border border-white/15 bg-[#04122a]/92 p-3 text-sky-100 backdrop-blur">
            <div className="text-[9px] uppercase tracking-[0.18em] text-sky-300/70 mb-2">
              Radio de análisis
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(radius === r ? null : r)}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px]",
                    radius === r
                      ? "border-sky-400 bg-sky-500/25 text-white"
                      : "border-white/15 text-sky-100/80 hover:border-sky-400/60",
                  )}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda de portafolios */}
      {portfolios.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[500] rounded-md border border-white/15 bg-[#04122a]/85 px-3 py-2 text-[10px] text-sky-100 backdrop-blur">
          {portfolios.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-0.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </div>
          ))}
          {mode === "public" && (
            <div className="mt-1 pt-1 border-t border-white/10 text-sky-300/70">
              Ubicación aproximada · coordenadas exactas en el data room
            </div>
          )}
        </div>
      )}
    </div>
  );
}
