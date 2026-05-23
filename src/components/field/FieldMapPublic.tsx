import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import "leaflet/dist/leaflet.css";
import type { GeoJSON as LeafletGeoJSON, LayerGroup, Map as LeafletMap, Marker, Circle } from "leaflet";
import { Crosshair, MapPin, Loader2, RefreshCw, WifiOff, Download, Trash2, Box, Flame, Zap, Layers } from "lucide-react";
import { toast } from "sonner";

import {
  getLosVerdesPublicLayers,
  getLosVerdesAnomalies,
  type PublicTarget,
  type PublicProjectConcession,
  type LosVerdesAnomalies,
} from "@/lib/livemap-public.functions";
import { useGeolocation } from "@/hooks/useGeolocation";
import { InstallPwaButton } from "@/components/field/InstallPwaButton";
import {
  buildAnomalyHeatLayer,
  buildLineamentsLayer,
  removeLayer,
} from "@/components/field/anomalyHeatLayer";
import { loadCatastro, bboxAround } from "@/components/map/catastroLayer";
import { CATASTRO_STYLE, type CatastroOrigen } from "@/components/map/overlays";

const Structures3DViewer = lazy(() => import("@/components/field/Structures3DViewer"));

type LeafletNS = typeof import("leaflet");

type LocalPoi = {
  id: string;
  type: string;
  title: string;
  note: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  elevation_m: number | null;
  photo_dataurl: string | null;
  created_at: string;
};

const POI_TYPES = [
  { value: "outcrop", label: "Afloramiento", color: "#F0C96B" },
  { value: "alteration", label: "Alteración", color: "#E07A5F" },
  { value: "vein", label: "Veta", color: "#dc2626" },
  { value: "structure", label: "Estructura", color: "#9b72cf" },
  { value: "sample", label: "Muestra", color: "#3b82f6" },
  { value: "lithology", label: "Contacto litológico", color: "#10b981" },
  { value: "infrastructure", label: "Infraestructura", color: "#64748b" },
  { value: "hse_risk", label: "Riesgo HSE", color: "#f59e0b" },
  { value: "other", label: "Otro", color: "#a8a29e" },
];

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#F0C96B",
  medium: "#3b82f6",
  low: "#94a3b8",
};

const STORAGE_KEY = "live_map_losverdes_pois";

function loadLocalPois(): LocalPoi[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalPoi[]) : [];
  } catch {
    return [];
  }
}

function saveLocalPois(pois: LocalPoi[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pois));
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function ChipBtn({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="pointer-events-auto min-h-[36px] px-2.5 rounded-md border font-mono text-[11px] backdrop-blur"
      style={{
        background: active ? `${color}26` : "rgba(20,18,15,0.85)",
        borderColor: active ? color : "var(--border)",
        color: active ? color : "var(--muted-foreground)",
      }}
    >
      {children}
    </button>
  );
}

export function FieldMapPublic() {
  const fetchLayers = useServerFn(getLosVerdesPublicLayers);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const targetsLayerRef = useRef<LayerGroup | null>(null);
  const poiLayerRef = useRef<LayerGroup | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);
  const meCircleRef = useRef<Circle | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [targets, setTargets] = useState<PublicTarget[]>([]);
  const [center, setCenter] = useState<[number, number]>([-32.04, -71.11]);
  const [loadingData, setLoadingData] = useState(true);
  const [follow, setFollow] = useState(false);
  const [showTargets, setShowTargets] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showLineaments, setShowLineaments] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [showCatastro, setShowCatastro] = useState(false);
  const [catastroCount, setCatastroCount] = useState<number | null>(null);
  const [loadingCatastro, setLoadingCatastro] = useState(false);
  const [projectConcessions, setProjectConcessions] = useState<PublicProjectConcession[]>([]);
  const catastroLayerRef = useRef<LayerGroup | null>(null);
  const [anomalies, setAnomalies] = useState<LosVerdesAnomalies | null>(null);
  const [loadingAnoms, setLoadingAnoms] = useState(false);
  const heatLayerRef = useRef<LayerGroup | null>(null);
  const lineamentsLayerRef = useRef<LayerGroup | null>(null);
  const fetchAnomalies = useServerFn(getLosVerdesAnomalies);
  const [pois, setPois] = useState<LocalPoi[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const projectConcessionNorm = useMemo(
    () =>
      projectConcessions.map((c) =>
        c.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    [projectConcessions],
  );

  const { position, status: geoStatus } = useGeolocation(true);

  useEffect(() => {
    setPois(loadLocalPois());
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Load public layers
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await fetchLayers();
        if (cancel) return;
        setTargets(data.targets);
        if (data.project.center_lat != null && data.project.center_lng != null) {
          setCenter([data.project.center_lat, data.project.center_lng]);
        }
      } catch (e) {
        toast.error("No se pudieron cargar las capas");
        console.error(e);
      } finally {
        if (!cancel) setLoadingData(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchLayers]);

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default as unknown as LeafletNS;
      if (cancelled) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        center,
        zoom: 13,
        zoomControl: false,
        preferCanvas: true,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      const sat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles &copy; Esri" },
      ).addTo(map);
      const topo = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles &copy; Esri" },
      );
      L.control.layers({ Satélite: sat, Topográfico: topo }, {}, { position: "topright" }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when project center loads
  useEffect(() => {
    if (mapReady && mapRef.current) {
      mapRef.current.setView(center, 13);
    }
  }, [center, mapReady]);

  // Targets layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (targetsLayerRef.current) {
      map.removeLayer(targetsLayerRef.current);
      targetsLayerRef.current = null;
    }
    if (!showTargets) return;
    const group = L.layerGroup();
    for (const t of targets) {
      if (t.lat == null || t.lng == null) continue;
      const color = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
      const m = L.circleMarker([t.lat, t.lng], {
        radius: t.priority === "critical" ? 11 : t.priority === "high" ? 9 : 7,
        color: "#0b0a09",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92,
      });
      m.bindPopup(
        `<div style="font-family:monospace;font-size:12px;min-width:180px">
          <div style="color:#F0C96B;font-weight:700">${t.code}</div>
          <div style="color:#E8DDD0;margin:2px 0 4px">${t.name}</div>
          <div style="color:#A89080">${t.target_type}${t.commodity ? ` · ${t.commodity}` : ""}${t.score != null ? ` · score ${t.score}` : ""}</div>
          <div style="color:#A89080;font-size:11px;margin-top:4px">${t.priority.toUpperCase()} · ${t.stage}</div>
          ${t.rationale ? `<div style="color:#C8B8A8;margin-top:6px;font-size:11px">${t.rationale.slice(0, 200)}</div>` : ""}
        </div>`,
      );
      m.addTo(group);
    }
    group.addTo(map);
    targetsLayerRef.current = group;
  }, [targets, showTargets, mapReady]);

  // Lazy-fetch anomalies the first time heatmap or lineaments is enabled
  useEffect(() => {
    if (!showHeatmap && !showLineaments) return;
    if (anomalies || loadingAnoms) return;
    setLoadingAnoms(true);
    fetchAnomalies()
      .then((data) => setAnomalies(data))
      .catch((e) => {
        console.error(e);
        toast.error("No se pudieron cargar anomalías");
      })
      .finally(() => setLoadingAnoms(false));
  }, [showHeatmap, showLineaments, anomalies, loadingAnoms, fetchAnomalies]);

  // Heatmap layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    let active = true;
    removeLayer(map, heatLayerRef.current);
    heatLayerRef.current = null;
    if (!showHeatmap || !anomalies) return;
    (async () => {
      const layer = await buildAnomalyHeatLayer(L, map, anomalies.magTargets, anomalies.satAnomalies);
      if (!active) {
        removeLayer(map, layer);
        return;
      }
      heatLayerRef.current = layer;
    })();
    return () => {
      active = false;
    };
  }, [showHeatmap, anomalies, mapReady]);

  // Lineaments layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    removeLayer(map, lineamentsLayerRef.current);
    lineamentsLayerRef.current = null;
    if (!showLineaments || !anomalies) return;
    lineamentsLayerRef.current = buildLineamentsLayer(L, map, anomalies.lineaments);
  }, [showLineaments, anomalies, mapReady]);



  // POI layer
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady) return;
    if (poiLayerRef.current) {
      map.removeLayer(poiLayerRef.current);
      poiLayerRef.current = null;
    }
    const group = L.layerGroup();
    for (const p of pois) {
      const meta = POI_TYPES.find((t) => t.value === p.type) ?? POI_TYPES[POI_TYPES.length - 1];
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "#0b0a09",
        weight: 2,
        fillColor: meta.color,
        fillOpacity: 0.95,
      });
      const date = new Date(p.created_at).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      m.bindPopup(
        `<div style="font-family:monospace;font-size:12px;max-width:240px">
          <div style="color:#F0C96B;font-weight:700">${meta.label}</div>
          <div style="color:#E8DDD0;font-weight:600;margin-top:2px">${p.title.replace(/</g, "&lt;")}</div>
          ${p.note ? `<div style="color:#C8B8A8;margin-top:4px">${p.note.replace(/</g, "&lt;")}</div>` : ""}
          ${p.photo_dataurl ? `<img src="${p.photo_dataurl}" style="margin-top:6px;max-width:220px;border-radius:4px"/>` : ""}
          <div style="color:#A89080;font-size:10px;margin-top:6px">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} · ${date}</div>
          <button data-del="${p.id}" style="margin-top:6px;padding:4px 8px;border:1px solid #3a322c;background:transparent;color:#dc2626;cursor:pointer;font-family:monospace;font-size:11px">Borrar</button>
        </div>`,
      );
      m.addTo(group);
    }
    group.addTo(map);
    poiLayerRef.current = group;

    const handler = (ev: Event) => {
      const target = ev.target as HTMLElement;
      const id = target?.getAttribute?.("data-del");
      if (id) {
        const next = pois.filter((p) => p.id !== id);
        setPois(next);
        saveLocalPois(next);
        map.closePopup();
        toast.success("Nota eliminada");
      }
    };
    map.getContainer().addEventListener("click", handler);
    return () => {
      map.getContainer().removeEventListener("click", handler);
    };
  }, [pois, mapReady]);

  // GPS marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapReady || !position) return;
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.circleMarker([position.lat, position.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }).addTo(map) as unknown as Marker;
    } else {
      (meMarkerRef.current as unknown as { setLatLng: (ll: [number, number]) => void }).setLatLng([
        position.lat,
        position.lng,
      ]);
    }
    if (position.accuracy != null) {
      if (!meCircleRef.current) {
        meCircleRef.current = L.circle([position.lat, position.lng], {
          radius: position.accuracy,
          color: "#3b82f6",
          weight: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        meCircleRef.current.setLatLng([position.lat, position.lng]);
        meCircleRef.current.setRadius(position.accuracy);
      }
    }
    if (follow) map.setView([position.lat, position.lng]);
  }, [position, mapReady, follow]);

  const centerOnMe = useCallback(() => {
    if (!position || !mapRef.current) {
      toast.error("Sin señal GPS aún");
      return;
    }
    mapRef.current.setView([position.lat, position.lng], 17);
  }, [position]);

  const exportGeoJSON = useCallback(() => {
    const fc = {
      type: "FeatureCollection" as const,
      features: pois.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          type: p.type,
          title: p.title,
          note: p.note,
          accuracy_m: p.accuracy_m,
          elevation_m: p.elevation_m,
          created_at: p.created_at,
          has_photo: !!p.photo_dataurl,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `losverdes_notas_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${pois.length} notas`);
  }, [pois]);

  return (
    <div className="relative w-full h-[calc(100vh-40px)] bg-bg-app">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-[1000]">
        <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-panel/90 backdrop-blur border border-border font-mono text-[11px] text-foreground">
          <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
          {online ? "ONLINE" : "OFFLINE"}
          {loadingData && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          <span className="text-muted-foreground">· {targets.length} targets · {pois.length} notas</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <InstallPwaButton />
        </div>
      </div>

      {/* Layer chips row */}
      <div className="absolute top-14 left-3 right-3 z-[1000] flex flex-wrap gap-1.5 pointer-events-none">
        <ChipBtn active={showTargets} color="#F0C96B" onClick={() => setShowTargets((v) => !v)}>
          🎯 Targets
        </ChipBtn>
        <ChipBtn active={showHeatmap} color="#dc2626" onClick={() => setShowHeatmap((v) => !v)}>
          <Flame className="w-3 h-3 inline mr-1" />
          Heatmap
        </ChipBtn>
        <ChipBtn active={showLineaments} color="#facc15" onClick={() => setShowLineaments((v) => !v)}>
          <Zap className="w-3 h-3 inline mr-1" />
          Vetas
        </ChipBtn>
        <ChipBtn active={show3D} color="#a78bfa" onClick={() => setShow3D(true)}>
          <Box className="w-3 h-3 inline mr-1" />
          3D
        </ChipBtn>
        {loadingAnoms && (
          <span className="pointer-events-auto inline-flex items-center gap-1 px-2 rounded-md bg-bg-panel/90 backdrop-blur border border-border font-mono text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> anomalías
          </span>
        )}
      </div>

      {/* Heatmap legend */}
      {showHeatmap && (
        <div className="absolute bottom-20 left-3 z-[1000] p-2 rounded-md bg-bg-panel/90 backdrop-blur border border-border font-mono text-[10px] text-muted-foreground">
          <div className="text-gold font-bold mb-1">Intensidad anomalía</div>
          <div
            className="h-2 w-32 rounded"
            style={{
              background:
                "linear-gradient(90deg,#1e3a8a 0%,#0ea5e9 30%,#facc15 50%,#fb923c 70%,#dc2626 100%)",
            }}
          />
          <div className="flex justify-between mt-1"><span>baja</span><span>alta</span></div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-3 right-3 z-[1000] flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFollow((v) => !v)}
            className={`min-h-[44px] px-3 rounded-md border font-mono text-xs ${
              follow ? "bg-blue-500/15 border-blue-500 text-blue-400" : "bg-bg-panel/90 border-border text-muted-foreground"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 inline mr-1" />
            {follow ? "Siguiendo" : "Seguir"}
          </button>
          <button
            onClick={exportGeoJSON}
            disabled={!pois.length}
            className="min-h-[44px] px-3 rounded-md border border-border bg-bg-panel/90 text-foreground font-mono text-xs disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            Exportar
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={centerOnMe}
            className="min-h-[44px] w-12 rounded-md border border-border bg-bg-panel/90 text-foreground flex items-center justify-center"
            aria-label="Centrar en mi posición"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (!position) {
                toast.error("Sin señal GPS aún");
                return;
              }
              setSheetOpen(true);
            }}
            className="min-h-[56px] px-5 rounded-md border border-gold bg-gold text-bg-app font-mono text-sm font-bold flex items-center gap-2 shadow-lg"
          >
            <MapPin className="w-5 h-5" />
            Nota aquí
          </button>
        </div>
      </div>

      {geoStatus === "denied" && (
        <div className="absolute top-28 left-3 right-3 z-[1000] p-3 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          Permite el acceso a la ubicación en tu navegador para usar el GPS.
        </div>
      )}

      {sheetOpen && position && (
        <NoteSheet
          coords={{
            lat: position.lat,
            lng: position.lng,
            accuracy: position.accuracy ?? null,
            elevation: position.altitude ?? null,
          }}
          onClose={() => setSheetOpen(false)}
          onSave={(p) => {
            const next = [p, ...pois];
            setPois(next);
            saveLocalPois(next);
            setSheetOpen(false);
            toast.success("Nota guardada localmente");
          }}
        />
      )}

      {show3D && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[3000] bg-bg-app flex items-center justify-center text-muted-foreground font-mono text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando 3D…
          </div>
        }>
          <Structures3DViewer onClose={() => setShow3D(false)} />
        </Suspense>
      )}
    </div>
  );
}

function NoteSheet({
  coords,
  onClose,
  onSave,
}: {
  coords: { lat: number; lng: number; accuracy: number | null; elevation: number | null };
  onClose: () => void;
  onSave: (p: LocalPoi) => void;
}) {
  const [type, setType] = useState("outcrop");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    let photo_dataurl: string | null = null;
    if (photo) {
      try {
        photo_dataurl = await fileToDataUrl(photo);
      } catch {
        toast.error("No se pudo leer la foto");
      }
    }
    onSave({
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      note: note.trim(),
      lat: coords.lat,
      lng: coords.lng,
      accuracy_m: coords.accuracy,
      elevation_m: coords.elevation,
      photo_dataurl,
      created_at: new Date().toISOString(),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-bg-panel border-t border-border rounded-t-xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-bold text-gold">Nueva nota de campo</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground text-xs font-mono">
            Cerrar
          </button>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {coords.accuracy != null && ` · ±${Math.round(coords.accuracy)} m`}
          {coords.elevation != null && ` · ${Math.round(coords.elevation)} msnm`}
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-md border border-border bg-bg-app text-foreground font-mono text-sm"
          >
            {POI_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Veta cuarzo NE 60°"
            className="w-full min-h-[44px] px-3 rounded-md border border-border bg-bg-app text-foreground font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1">Nota</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Observaciones, rumbo/manteo, alteración, mineralización…"
            className="w-full px-3 py-2 rounded-md border border-border bg-bg-app text-foreground font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-1">Foto (opcional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="w-full text-xs font-mono text-foreground"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[52px] rounded-md bg-gold text-bg-app font-mono text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          Guardar nota
        </button>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <Trash2 className="w-3 h-3" /> Las notas se guardan en tu dispositivo. Usa "Exportar" para descargarlas como GeoJSON.
        </div>
      </form>
    </div>
  );
}
