import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  LayersControl,
  Tooltip,
  GeoJSON,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import type { ExplorationTarget, TargetPriority } from "@/hooks/useExplorationTargets";
import { PRIORITY_META } from "@/hooks/useExplorationTargets";
import {
  MapPin,
  Filter,
  Crosshair,
  Navigation,
  NavigationOff,
  Loader2,
  Bell,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useGeolocation, haversineMeters, type GeoPosition } from "@/hooks/useGeolocation";
import { UserLocationLayer } from "./UserLocationLayer";
import { NearestTargetPanel } from "./NearestTargetPanel";
import type { ConcessionRow } from "@/hooks/useProjectMiningConcessions";
import type {
  AnomaliesByIndex,
  AnomalyRow,
  SatIndexCode,
} from "@/hooks/useProjectSatelliteAnomalies";
import { TargetsMapLegend, INDEX_META } from "./TargetsMapLegend";
import type { PathOptions } from "leaflet";

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

const GEOFENCE_STORAGE_KEY = "targets_geofence_cfg_v1";
const DEFAULT_RADIUS = 100;
const DEFAULT_ALERT_PRIORITIES: Record<TargetPriority, boolean> = {
  critical: true,
  high: true,
  medium: false,
  low: false,
};

type GeofenceCfg = {
  radius: number;
  alertPriorities: Record<TargetPriority, boolean>;
};

function loadGeofenceCfg(): GeofenceCfg {
  if (typeof window === "undefined")
    return { radius: DEFAULT_RADIUS, alertPriorities: DEFAULT_ALERT_PRIORITIES };
  try {
    const raw = window.localStorage.getItem(GEOFENCE_STORAGE_KEY);
    if (!raw) return { radius: DEFAULT_RADIUS, alertPriorities: DEFAULT_ALERT_PRIORITIES };
    const parsed = JSON.parse(raw);
    return {
      radius: Number.isFinite(parsed.radius)
        ? Math.min(5000, Math.max(20, Number(parsed.radius)))
        : DEFAULT_RADIUS,
      alertPriorities: { ...DEFAULT_ALERT_PRIORITIES, ...(parsed.alertPriorities ?? {}) },
    };
  } catch {
    return { radius: DEFAULT_RADIUS, alertPriorities: DEFAULT_ALERT_PRIORITIES };
  }
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [bounds, map]);
  return null;
}

function MapRefCatcher({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export function TargetsMap({
  targets,
  concessions,
  anomaliesByIndex,
}: {
  targets: ExplorationTarget[];
  concessions?: ConcessionRow[];
  anomaliesByIndex?: AnomaliesByIndex;
}) {
  const geoTargets = useMemo(
    () =>
      targets.filter(
        (t) =>
          t.lat != null &&
          t.lng != null &&
          Number.isFinite(Number(t.lat)) &&
          Number.isFinite(Number(t.lng)),
      ),
    [targets],
  );

  const commodities = useMemo(() => {
    const s = new Set<string>();
    geoTargets.forEach((t) => t.commodity && s.add(t.commodity));
    return Array.from(s).sort();
  }, [geoTargets]);

  const [enabledPriorities, setEnabledPriorities] = useState<Record<TargetPriority, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
  });
  const [commodityFilter, setCommodityFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      geoTargets.filter(
        (t) =>
          enabledPriorities[t.priority] &&
          (commodityFilter === "all" || t.commodity === commodityFilter),
      ),
    [geoTargets, enabledPriorities, commodityFilter],
  );

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (filtered.length === 0) return null;
    const lats = filtered.map((t) => Number(t.lat));
    const lngs = filtered.map((t) => Number(t.lng));
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<TargetPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    geoTargets.forEach((t) => {
      c[t.priority]++;
    });
    return c;
  }, [geoTargets]);

  const mapRef = useRef<HTMLDivElement>(null);

  // === GPS ===
  const [tracking, setTracking] = useState(false);
  const [onceLoading, setOnceLoading] = useState(false);
  const [oncePos, setOncePos] = useState<GeoPosition | null>(null);
  const { position: watchPos, status, error } = useGeolocation(tracking);

  // Effective position: tracking takes precedence over one-shot
  const position: GeoPosition | null = tracking ? watchPos : oncePos;

  const [geofenceCfg, setGeofenceCfg] = useState<GeofenceCfg>(() => loadGeofenceCfg());
  const [showCfg, setShowCfg] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(geofenceCfg));
    } catch {
      /* noop */
    }
  }, [geofenceCfg]);

  const leafletRef = useRef<LeafletMap | null>(null);
  const onMapReady = (m: LeafletMap) => {
    leafletRef.current = m;
  };

  function locateOnce() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocalización no soportada en este dispositivo");
      return;
    }
    setOnceLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const gp: GeoPosition = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          altitudeAccuracy: p.coords.altitudeAccuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
          timestamp: p.timestamp,
        };
        setOncePos(gp);
        setOnceLoading(false);
        if (leafletRef.current) {
          leafletRef.current.setView([gp.lat, gp.lng], Math.max(leafletRef.current.getZoom(), 15));
        }
        toast.success(`Ubicación obtenida · ±${gp.accuracy.toFixed(0)} m`);
      },
      (err) => {
        setOnceLoading(false);
        if (err.code === err.PERMISSION_DENIED) toast.error("Permiso de ubicación denegado");
        else toast.error(`GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  // Geofence alerts (configurable radius + priorities)
  const insideRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!position) return;
    const enterM = geofenceCfg.radius;
    const exitM = geofenceCfg.radius * 1.5;
    for (const t of filtered) {
      if (!geofenceCfg.alertPriorities[t.priority]) continue;
      if (t.lat == null || t.lng == null) continue;
      const d = haversineMeters(position, { lat: Number(t.lat), lng: Number(t.lng) });
      const wasInside = insideRef.current.has(t.id);
      if (!wasInside && d <= enterM) {
        insideRef.current.add(t.id);
        toast.success(
          `Cerca de ${t.code} (${d.toFixed(0)} m) · ${PRIORITY_META[t.priority].label}`,
          { duration: 6000 },
        );
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          /* noop */
        }
      } else if (wasInside && d > exitM) {
        insideRef.current.delete(t.id);
      }
    }
  }, [position, filtered, geofenceCfg]);

  function goToTarget(t: ExplorationTarget) {
    if (!leafletRef.current || t.lat == null || t.lng == null) return;
    leafletRef.current.setView(
      [Number(t.lat), Number(t.lng)],
      Math.max(leafletRef.current.getZoom(), 16),
    );
  }

  if (geoTargets.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-bg-secondary p-8 text-center">
        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
        <div className="text-xs font-mono text-muted-foreground">
          Ningún target con coordenadas WGS84
        </div>
      </div>
    );
  }

  const gpsLabel =
    status === "denied"
      ? "GPS denegado"
      : status === "unavailable"
        ? "GPS no soportado"
        : status === "error"
          ? `GPS error`
          : position
            ? `GPS ±${position.accuracy.toFixed(0)} m`
            : tracking
              ? "Buscando señal…"
              : "GPS apagado";

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
              {commodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-[10px] ${status === "denied" || status === "error" ? "text-destructive" : position ? "text-sky-400" : "text-muted-foreground"}`}
          >
            {gpsLabel}
          </span>
          <button
            type="button"
            onClick={locateOnce}
            disabled={onceLoading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-sky-500/40 text-sky-300 bg-sky-500/5 hover:bg-sky-500/10 disabled:opacity-50"
            title="Obtener mi ubicación una vez"
          >
            {onceLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Crosshair className="w-3 h-3" />
            )}
            Ubicarme
          </button>
          <button
            type="button"
            onClick={() => setTracking((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
              tracking
                ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
            title={tracking ? "Detener seguimiento GPS" : "Iniciar seguimiento GPS"}
          >
            {tracking ? <Navigation className="w-3 h-3" /> : <NavigationOff className="w-3 h-3" />}
            {tracking ? "Siguiendo" : "Seguir"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCfg((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                showCfg
                  ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              title="Configurar alertas de geofence"
            >
              <Settings2 className="w-3 h-3" />
              Alertas
            </button>
            {showCfg && (
              <div className="absolute right-0 top-full mt-1 z-[500] w-72 rounded-md border border-border bg-background shadow-xl p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  <Bell className="w-3 h-3" /> Geofence
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Radio de alerta</span>
                    <span className="text-foreground tabular-nums">
                      {geofenceCfg.radius >= 1000
                        ? `${(geofenceCfg.radius / 1000).toFixed(1)} km`
                        : `${geofenceCfg.radius} m`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={2000}
                    step={10}
                    value={geofenceCfg.radius}
                    onChange={(e) =>
                      setGeofenceCfg((c) => ({ ...c, radius: Number(e.target.value) }))
                    }
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                    <span>20 m</span>
                    <span>2 km</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Notificar al acercarse a:
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(PRIORITY_COLORS) as TargetPriority[]).map((p) => (
                      <label
                        key={p}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border text-[10px] font-mono cursor-pointer hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={geofenceCfg.alertPriorities[p]}
                          onChange={(e) =>
                            setGeofenceCfg((c) => ({
                              ...c,
                              alertPriorities: { ...c.alertPriorities, [p]: e.target.checked },
                            }))
                          }
                          className="accent-amber-500"
                        />
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: PRIORITY_COLORS[p] }}
                        />
                        <span>{PRIORITY_META[p].label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setGeofenceCfg({
                        radius: DEFAULT_RADIUS,
                        alertPriorities: DEFAULT_ALERT_PRIORITIES,
                      });
                      insideRef.current.clear();
                    }}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
                  >
                    Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCfg(false)}
                    className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:bg-accent"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
          <span className="text-muted-foreground hidden md:inline">
            {filtered.length} / {geoTargets.length} visibles
          </span>
        </div>
      </div>

      {error && status === "denied" && (
        <div className="px-3 py-1.5 text-[10px] font-mono text-destructive bg-destructive/5 border-b border-destructive/20">
          Permiso de ubicación denegado. Habilita el GPS en los ajustes del navegador para usar el
          mapa en terreno.
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="relative h-[420px] md:h-[520px] w-full">
        <MapContainer
          center={bounds ? undefined : [-32.04, -71.08]}
          bounds={bounds ?? undefined}
          zoom={bounds ? undefined : 12}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
        >
          <MapRefCatcher onReady={onMapReady} />
          <FitBounds bounds={bounds} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satélite (Esri)">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri, Maxar, Earthstar Geographics"
                maxZoom={19}
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Topográfico">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri"
                maxZoom={19}
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
                attribution="&copy; OpenStreetMap"
                crossOrigin="anonymous"
              />
            </LayersControl.BaseLayer>

            {concessions && concessions.filter((c) => c.geometry_geojson).length > 0 && (
              <LayersControl.Overlay checked name="Catastro (concesiones)">
                <GeoJSON
                  key={`conc-${concessions.length}`}
                  data={
                    {
                      type: "FeatureCollection",
                      features: concessions
                        .filter((c) => c.geometry_geojson)
                        .map((c) => ({
                          type: "Feature" as const,
                          geometry: c.geometry_geojson as GeoJSON.Geometry,
                          properties: {
                            code: c.code,
                            name: c.name,
                            holder: c.holder,
                            area_ha: c.area_ha,
                            concession_type: c.concession_type,
                          },
                        })),
                    } as GeoJSON.FeatureCollection
                  }
                  style={(feat): PathOptions => {
                    const type = feat?.properties?.concession_type ?? "explotacion";
                    const cssVar =
                      type === "exploracion" ? "--catastro-exploracion" : "--catastro-explotacion";
                    return {
                      color: `var(${cssVar})`,
                      weight: 1.5,
                      fillColor: `var(${cssVar})`,
                      fillOpacity: 0.18,
                    };
                  }}
                  onEachFeature={(feat, layer) => {
                    const p = feat.properties as {
                      code: string;
                      name: string;
                      holder: string | null;
                      area_ha: number | null;
                    };
                    layer.bindTooltip(
                      `<div class="text-[10px] font-mono"><strong>${p.code}</strong> · ${p.name}<br/>${p.holder ?? "—"}${p.area_ha != null ? ` · ${p.area_ha} ha` : ""}</div>`,
                      { sticky: true },
                    );
                  }}
                />
              </LayersControl.Overlay>
            )}

            {anomaliesByIndex &&
              (Object.keys(INDEX_META) as SatIndexCode[]).map((idx) => {
                const arr = anomaliesByIndex[idx];
                if (!arr || arr.length === 0) return null;
                const meta = INDEX_META[idx];
                return (
                  <LayersControl.Overlay checked key={idx} name={`Sat · ${meta.label}`}>
                    <GeoJSON
                      key={`${idx}-${arr.length}`}
                      data={
                        {
                          type: "FeatureCollection",
                          features: arr.map((a: AnomalyRow) => ({
                            type: "Feature" as const,
                            geometry: a.geometry,
                            properties: {
                              id: a.id,
                              index_code: a.index_code,
                              severity: a.severity,
                              score: a.score,
                              area_ha: a.area_ha,
                              notes: a.notes,
                            },
                          })),
                        } as GeoJSON.FeatureCollection
                      }
                      style={(feat): PathOptions => {
                        const score = Number(feat?.properties?.score ?? 0.5);
                        return {
                          color: `var(${meta.cssVar})`,
                          weight: 1.4,
                          fillColor: `var(${meta.cssVar})`,
                          fillOpacity: Math.max(0.15, Math.min(0.55, score * 0.6)),
                        };
                      }}
                      onEachFeature={(feat, layer) => {
                        const p = feat.properties as {
                          severity: string;
                          score: number;
                          area_ha: number | null;
                          notes: string | null;
                        };
                        layer.bindPopup(
                          `<div class="text-[10px] font-mono space-y-0.5 min-w-[180px]"><div><strong>${meta.label}</strong></div><div>Severidad: ${p.severity}</div><div>Score: ${Number(p.score).toFixed(2)}</div><div>Área: ${p.area_ha ?? "—"} ha</div>${p.notes ? `<div class="text-gray-500 pt-1 border-t border-gray-200">${p.notes}</div>` : ""}</div>`,
                        );
                      }}
                    />
                  </LayersControl.Overlay>
                );
              })}
          </LayersControl>

          <UserLocationLayer position={position} follow={tracking} />

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
                    <div>
                      {t.commodity ?? "—"} · {PRIORITY_META[t.priority].label}
                    </div>
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
                      <div className="text-[10px]">
                        Score: <strong>{Number(t.score).toFixed(0)}</strong>
                      </div>
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

        <TargetsMapLegend anomaliesByIndex={anomaliesByIndex} concessions={concessions} />

        {/* Nearest target overlay */}
        {position && (
          <div className="absolute left-2 bottom-2 right-2 md:right-auto md:max-w-md z-[400] px-3 py-2 rounded-md border border-sky-500/30 bg-background/90 backdrop-blur shadow-lg">
            <div className="text-[9px] font-mono uppercase tracking-wider text-sky-400 mb-1">
              Target más cercano
            </div>
            <NearestTargetPanel position={position} targets={filtered} onGoTo={goToTarget} />
          </div>
        )}
      </div>
    </div>
  );
}
