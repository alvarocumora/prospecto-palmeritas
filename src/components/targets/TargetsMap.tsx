import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import type { ExplorationTarget, TargetPriority } from "@/hooks/useExplorationTargets";
import { PRIORITY_META } from "@/hooks/useExplorationTargets";
import { MapPin, Filter } from "lucide-react";

const PRIORITY_COLORS: Record<TargetPriority, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#9ca3af",
};

const PRIORITY_RADIUS: Record<TargetPriority, number> = {
  critical: 11,
  high: 9,
  medium: 7,
  low: 5,
};

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [bounds, map]);
  return null;
}

export function TargetsMap({ targets }: { targets: ExplorationTarget[] }) {
  const geoTargets = useMemo(
    () => targets.filter((t) => t.lat != null && t.lng != null && Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lng))),
    [targets],
  );

  const commodities = useMemo(() => {
    const s = new Set<string>();
    geoTargets.forEach((t) => t.commodity && s.add(t.commodity));
    return Array.from(s).sort();
  }, [geoTargets]);

  const [enabledPriorities, setEnabledPriorities] = useState<Record<TargetPriority, boolean>>({
    critical: true, high: true, medium: true, low: true,
  });
  const [commodityFilter, setCommodityFilter] = useState<string>("all");

  const filtered = useMemo(
    () => geoTargets.filter((t) =>
      enabledPriorities[t.priority] &&
      (commodityFilter === "all" || t.commodity === commodityFilter),
    ),
    [geoTargets, enabledPriorities, commodityFilter],
  );

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (filtered.length === 0) return null;
    const lats = filtered.map((t) => Number(t.lat));
    const lngs = filtered.map((t) => Number(t.lng));
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<TargetPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    geoTargets.forEach((t) => { c[t.priority]++; });
    return c;
  }, [geoTargets]);

  const mapRef = useRef<HTMLDivElement>(null);

  if (geoTargets.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-bg-secondary p-8 text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <div className="text-xs font-mono text-muted-foreground">Ningún target con coordenadas WGS84</div>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-bg-secondary overflow-hidden">
      {/* Controls */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-3 flex-wrap text-[10px] font-mono">
        <div className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Filter className="w-3 h-3" /> Prioridad:
        </div>
        {(Object.keys(PRIORITY_COLORS) as TargetPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setEnabledPriorities((prev) => ({ ...prev, [p]: !prev[p] }))}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-opacity ${
              enabledPriorities[p] ? "border-border opacity-100" : "border-border opacity-40"
            }`}
            title={`${PRIORITY_META[p].label} (${counts[p]})`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
            <span>{PRIORITY_META[p].label}</span>
            <span className="text-muted-foreground">({counts[p]})</span>
          </button>
        ))}

        {commodities.length > 0 && (
          <>
            <span className="text-muted-foreground ml-2">Commodity:</span>
            <select
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background text-[10px] font-mono"
            >
              <option value="all">Todos</option>
              {commodities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}

        <div className="ml-auto text-muted-foreground">
          {filtered.length} / {geoTargets.length} targets visibles
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="h-[420px] md:h-[520px] w-full">
        <MapContainer
          center={bounds ? undefined : [-32.04, -71.08]}
          bounds={bounds ?? undefined}
          zoom={bounds ? undefined : 12}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
        >
          <FitBounds bounds={bounds} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satélite (Esri)">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri, Maxar, Earthstar Geographics"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Topográfico">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
                attribution="&copy; OpenStreetMap"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {filtered.map((t) => {
            const color = PRIORITY_COLORS[t.priority];
            const radius = PRIORITY_RADIUS[t.priority];
            return (
              <CircleMarker
                key={t.id}
                center={[Number(t.lat), Number(t.lng)]}
                radius={radius}
                pathOptions={{
                  color,
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.75,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                  <div className="text-[10px] font-mono">
                    <div className="font-semibold">{t.code}</div>
                    <div>{t.commodity ?? "—"} · {PRIORITY_META[t.priority].label}</div>
                    {t.score != null && <div>★ {Number(t.score).toFixed(0)}</div>}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="text-xs font-mono space-y-1 min-w-[200px]">
                    <div className="text-[10px] text-gray-500">{t.code}</div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span
                        className="px-1.5 py-0.5 rounded text-white"
                        style={{ background: color }}
                      >
                        {PRIORITY_META[t.priority].label}
                      </span>
                      <span>{t.target_type}</span>
                      {t.commodity && <span>· {t.commodity}</span>}
                    </div>
                    {t.score != null && (
                      <div className="text-[10px]">Score: <strong>{Number(t.score).toFixed(0)}</strong></div>
                    )}
                    <div className="text-[10px] text-gray-500">
                      {Number(t.lat).toFixed(5)}, {Number(t.lng).toFixed(5)}
                    </div>
                    {t.rationale && (
                      <div className="text-[10px] pt-1 border-t border-gray-200 line-clamp-4">
                        {t.rationale}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
