import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap, Marker, Circle } from "leaflet";
import {
  Crosshair,
  MapPin,
  Loader2,
  RefreshCw,
  WifiOff,
  Target as TargetIcon,
  Layers,
  Compass,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useProjects } from "@/hooks/useProjects";
import { useMiningConcessions, EXPIRY_COLORS, expiryStatus } from "@/hooks/useMiningConcessions";
import { useFieldPois, useFieldPoiQueue, type NewFieldPoi } from "@/hooks/useFieldPois";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import {
  useProjectSatelliteAnomalies,
  SAT_INDEX_CODES,
  type SatIndexCode,
} from "@/hooks/useProjectSatelliteAnomalies";

import { CoordinateFooter } from "@/components/map/CoordinateFooter";
import { buildFieldPoisLayer } from "@/components/field/poiLayer";
import { buildFieldTargetsLayer } from "@/components/field/fieldTargetsLayer";
import {
  buildSatAnomalyOverlay,
  INDEX_COLOR as SAT_COLOR,
  INDEX_LABEL as SAT_LABEL,
} from "@/components/field/satAnomalyLayer";
import { POISheet } from "@/components/field/POISheet";
import { InstallPwaButton } from "@/components/field/InstallPwaButton";
import { ArRadarOverlay } from "@/components/ar/ArRadarOverlay";
import { buildGpx, buildKml, downloadBlob } from "@/lib/fieldExport";
import type { ArProjectedObject } from "@/types/ar";

type LeafletNS = typeof import("leaflet");

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function FieldMap() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;
  const orgId = (active as unknown as { organization_id?: string })?.organization_id ?? null;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const concessionLayerRef = useRef<LayerGroup | null>(null);
  const poiLayerRef = useRef<LayerGroup | null>(null);
  const targetsLayerRef = useRef<LayerGroup | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);
  const meCircleRef = useRef<Circle | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [showTargets, setShowTargets] = useState(true);
  const [follow, setFollow] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    elevation: number | null;
  } | null>(null);

  const { data: concessions } = useMiningConcessions(projectId);
  const { pois, create, remove, loading: poisLoading } = useFieldPois(projectId);
  const { queue, online, enqueue, flush } = useFieldPoiQueue();
  const { targets } = useExplorationTargets(projectId);
  const { position, status: geoStatus } = useGeolocation(true);

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default as unknown as LeafletNS;
      if (cancelled) return;
      LRef.current = L;
      const center: [number, number] =
        active?.center_lat != null && active?.center_lng != null
          ? [active.center_lat, active.center_lng]
          : [-33.45, -70.65];
      const map = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: false,
        preferCanvas: true,
      });
      L.control.zoom({ position: "topright" }).addTo(map);

      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri",
        },
      ).addTo(map);
      const topo = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles &copy; Esri" },
      );
      L.control
        .layers({ Satélite: sat, Topográfico: topo }, {}, { position: "topright" })
        .addTo(map);

      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [active?.center_lat, active?.center_lng]);

  // Concessions layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (concessionLayerRef.current) {
      map.removeLayer(concessionLayerRef.current);
      concessionLayerRef.current = null;
    }
    if (!concessions.length) return;
    const group = L.layerGroup();
    let bounds: import("leaflet").LatLngBounds | null = null;
    for (const c of concessions) {
      if (!c.geometry_geojson) continue;
      const status = expiryStatus(c.expires_at);
      const color = EXPIRY_COLORS[status];
      const isPending = c.status === "en_tramite";
      try {
        const layer = L.geoJSON(c.geometry_geojson as never, {
          style: () => ({
            color,
            weight: 2,
            opacity: 0.9,
            fillColor: color,
            fillOpacity: 0.15,
            dashArray: isPending ? "6 4" : undefined,
          }),
        });
        layer.bindPopup(
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:180px">
            <div style="font-weight:700;margin-bottom:3px;color:#F0C96B">${c.code} — ${c.name}</div>
            <div style="color:#A89080">Titular: ${c.holder ?? "—"}</div>
            <div style="color:#A89080">Sup: ${c.area_ha ?? "—"} ha</div>
            <div style="color:${color};margin-top:3px">${c.expires_at ?? "Sin fecha"}</div>
          </div>`,
        );
        group.addLayer(layer);
        const b = layer.getBounds();
        bounds = bounds ? bounds.extend(b) : b;
      } catch {
        /* skip */
      }
    }
    group.addTo(map);
    concessionLayerRef.current = group;
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [concessions, mapReady]);

  // POIs layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (poiLayerRef.current) {
      map.removeLayer(poiLayerRef.current);
      poiLayerRef.current = null;
    }
    if (!pois.length) return;
    const group = buildFieldPoisLayer(L, pois, {
      onDelete: async (id) => {
        if (!confirm("¿Eliminar este punto?")) return;
        try {
          await remove(id);
          toast.success("Punto eliminado");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al eliminar");
        }
      },
    });
    group.addTo(map);
    poiLayerRef.current = group;
  }, [pois, mapReady, remove]);

  // Targets layer (read-only en terreno)
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (targetsLayerRef.current) {
      map.removeLayer(targetsLayerRef.current);
      targetsLayerRef.current = null;
    }
    if (!targets.length || !showTargets) return;
    const safe = targets.filter(
      (t) =>
        t.lat != null &&
        t.lng != null &&
        Number.isFinite(Number(t.lat)) &&
        Number.isFinite(Number(t.lng)),
    );
    if (safe.length === 0) return;
    const group = buildFieldTargetsLayer(L, safe);
    group.addTo(map);
    targetsLayerRef.current = group;
  }, [targets, mapReady, showTargets]);

  // GPS marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !position) return;
    const latlng: [number, number] = [position.lat, position.lng];
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.circleMarker(latlng, {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }).addTo(map) as unknown as Marker;
    } else {
      (meMarkerRef.current as unknown as { setLatLng: (ll: [number, number]) => void }).setLatLng(
        latlng,
      );
    }
    if (meCircleRef.current) map.removeLayer(meCircleRef.current);
    meCircleRef.current = L.circle(latlng, {
      radius: position.accuracy,
      color: "#3b82f6",
      weight: 1,
      fillColor: "#3b82f6",
      fillOpacity: 0.1,
    }).addTo(map);
    if (follow) map.setView(latlng, Math.max(map.getZoom(), 16), { animate: true });
  }, [position, mapReady, follow]);

  // Auto-flush queue on reconnect
  useEffect(() => {
    if (!online || queue.length === 0 || !projectId) return;
    void (async () => {
      const r = await flush(async (p) => create(p));
      if (r.ok > 0) toast.success(`Sincronizados ${r.ok} puntos pendientes`);
      if (r.failed > 0) toast.error(`${r.failed} puntos no se pudieron sincronizar`);
    })();
  }, [online, queue.length, projectId, flush, create]);

  const handleMarkPoint = () => {
    if (!projectId || !orgId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }
    if (position) {
      setPendingCoords({
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy ?? null,
        elevation: position.altitude ?? null,
      });
    } else if (mapRef.current) {
      const c = mapRef.current.getCenter();
      setPendingCoords({ lat: c.lat, lng: c.lng, accuracy: null, elevation: null });
      toast.message("Sin GPS — usando el centro del mapa");
    } else {
      toast.error("Sin coordenadas disponibles");
      return;
    }
    setSheetOpen(true);
  };

  const handleLocate = () => {
    if (!mapRef.current) return;
    if (!position) {
      toast.error(geoStatus === "denied" ? "Permiso de ubicación denegado" : "Aún sin señal GPS");
      return;
    }
    mapRef.current.setView([position.lat, position.lng], 17, { animate: true });
    setFollow(true);
  };

  if (!projectId || !orgId) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6 text-center">
        <div>
          <MapPin className="w-10 h-10 text-gold mx-auto mb-3" />
          <p className="text-sm font-mono text-muted-foreground">
            Selecciona un proyecto activo para abrir el mapa de campo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: "100dvh" }}>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between gap-2 px-3 py-2 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Mapa de campo</div>
          <div className="text-sm font-mono font-semibold truncate text-foreground">
            {active?.name}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {targets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTargets((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                showTargets
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
              }`}
              title={`${targets.length} targets · ${showTargets ? "Ocultar" : "Mostrar"}`}
              aria-pressed={showTargets}
            >
              <TargetIcon className="w-3 h-3" /> {targets.length}
            </button>
          )}
          {!online && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-signal-amber/40 bg-signal-amber/10 text-[10px] font-mono text-signal-amber">
              <WifiOff className="w-3 h-3" /> Offline{queue.length > 0 ? ` · ${queue.length}` : ""}
            </span>
          )}
          {online && queue.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-background/80 text-[10px] font-mono text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando {queue.length}
            </span>
          )}
          <InstallPwaButton />
        </div>
      </div>

      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" style={{ top: 0 }} />

      <CoordinateFooter map={mapRef.current} />

      {/* Legend */}
      <div
        className="absolute z-[900] left-2 px-2 py-1.5 rounded border border-border bg-background/85 backdrop-blur text-[10px] font-mono"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
      >
        <div className="text-muted-foreground mb-1">Pertenencias</div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPIRY_COLORS.ok }} />{" "}
            Vigente
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPIRY_COLORS.warning }} />{" "}
            Por vencer
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPIRY_COLORS.expired }} />{" "}
            Vencida
          </span>
        </div>
        {poisLoading && (
          <div className="mt-1 inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> POIs…
          </div>
        )}
      </div>

      {/* FABs */}
      <button
        type="button"
        onClick={handleLocate}
        aria-label="Mi ubicación"
        className="absolute z-[1000] right-3 w-12 h-12 rounded-full bg-background border border-border shadow-lg inline-flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
        title="Centrar en mi ubicación"
      >
        <Crosshair className={follow ? "w-5 h-5 text-gold" : "w-5 h-5 text-foreground"} />
      </button>

      <button
        type="button"
        onClick={handleMarkPoint}
        aria-label="Marcar punto"
        className="absolute z-[1000] right-3 w-14 h-14 rounded-full bg-gold text-background shadow-xl shadow-gold/30 inline-flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        title="Marcar punto de interés"
      >
        <MapPin className="w-6 h-6" />
      </button>

      <POISheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        coords={pendingCoords}
        online={online}
        projectId={projectId}
        organizationId={orgId}
        onSave={async (p: NewFieldPoi) => {
          await create(p);
        }}
        onQueue={(p) => enqueue(p)}
      />
    </div>
  );
}
