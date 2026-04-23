import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Database, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import type * as LType from "leaflet";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { catastroQueryUrl, CATASTRO_STYLE, catastroPopupHtml, type CatastroOrigen } from "@/components/map/overlays";
import type { MiningConcession } from "@/hooks/useMiningConcessions";
import { exportCatastroMapPdf } from "@/lib/pdf/catastro-map";

// ---------- Cache (bbox-keyed, localStorage 24h + in-memory) ----------
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "catastroMap:v1:";
type CacheEntry = { ts: number; bbox: BBox; fc: GeoJSON.FeatureCollection };
type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const memoryCache = new Map<string, CacheEntry>();

function bboxKey(b: BBox) {
  const r = (n: number) => n.toFixed(3);
  return `${CACHE_PREFIX}${r(b.minLng)},${r(b.minLat)},${r(b.maxLng)},${r(b.maxLat)}`;
}

function bboxContains(outer: BBox, inner: BBox) {
  return (
    outer.minLng <= inner.minLng + 1e-9 &&
    outer.minLat <= inner.minLat + 1e-9 &&
    outer.maxLng + 1e-9 >= inner.maxLng &&
    outer.maxLat + 1e-9 >= inner.maxLat
  );
}

/** Find a cached entry whose bbox fully contains the requested bbox. */
function findCoveringCache(target: BBox): CacheEntry | null {
  // 1) memory first
  for (const e of memoryCache.values()) {
    if (Date.now() - e.ts < CACHE_TTL_MS && bboxContains(e.bbox, target)) return e;
  }
  // 2) localStorage scan
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(CACHE_PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const e = JSON.parse(raw) as CacheEntry;
        if (Date.now() - e.ts > CACHE_TTL_MS) {
          window.localStorage.removeItem(k);
          continue;
        }
        if (bboxContains(e.bbox, target)) {
          memoryCache.set(k, e);
          return e;
        }
      } catch {
        window.localStorage.removeItem(k);
      }
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(bbox: BBox, fc: GeoJSON.FeatureCollection) {
  const key = bboxKey(bbox);
  const entry: CacheEntry = { ts: Date.now(), bbox, fc };
  memoryCache.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — purge oldest map entries and retry once.
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
      }
      keys.slice(0, Math.max(1, Math.floor(keys.length / 2))).forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(key, JSON.stringify(entry));
    } catch { /* give up */ }
  }
}

/** Pad a bbox by a fraction (e.g. 0.25 = +25% on each side) to prefetch surroundings. */
function padBbox(b: BBox, frac: number): BBox {
  const dLng = (b.maxLng - b.minLng) * frac;
  const dLat = (b.maxLat - b.minLat) * frac;
  return {
    minLng: b.minLng - dLng,
    maxLng: b.maxLng + dLng,
    minLat: b.minLat - dLat,
    maxLat: b.maxLat + dLat,
  };
}

/** Cheap bbox-intersect check on a GeoJSON Feature using its coordinate envelope. */
function featureIntersectsBbox(f: GeoJSON.Feature, b: BBox): boolean {
  const g = f.geometry;
  if (!g) return false;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (coords: unknown) => {
    if (typeof (coords as number[])[0] === "number") {
      const [x, y] = coords as number[];
      if (x < minLng) minLng = x;
      if (x > maxLng) maxLng = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
      return;
    }
    for (const c of coords as unknown[]) visit(c);
  };
  if ("coordinates" in g) visit((g as { coordinates: unknown }).coordinates);
  else return false;
  return !(maxLng < b.minLng || minLng > b.maxLng || maxLat < b.minLat || minLat > b.maxLat);
}

/** Parse SERNAGEOMIN FECHA_VENCIMIENTO (epoch ms or ISO date) and return days until expiry. */
function daysUntilExpiry(p: Record<string, unknown>): number | null {
  const raw = p.FECHA_VENCIMIENTO;
  if (raw == null) return null;
  let ts: number;
  if (typeof raw === "number") ts = raw;
  else {
    const d = new Date(String(raw));
    if (isNaN(d.getTime())) return null;
    ts = d.getTime();
  }
  return Math.floor((ts - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Severity tier from days-to-expiry (null = unknown, expired => "expired"). */
type ExpirySeverity = "expired" | "critical" | "warn" | "ok" | "unknown";
function expirySeverity(days: number | null): ExpirySeverity {
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warn";
  return "ok";
}
const EXPIRY_COLOR: Record<Exclude<ExpirySeverity, "ok" | "unknown">, string> = {
  expired: "#dc2626",
  critical: "#ef4444",
  warn: "#f59e0b",
};

type Props = {
  concessions: MiningConcession[];
  /** [lng, lat] center fallback */
  center?: [number, number];
  projectName?: string;
  /** Notified whenever new SERNAGEOMIN features are loaded for the bbox. */
  onFeaturesLoaded?: (fc: GeoJSON.FeatureCollection) => void;
};

/**
 * Mapa interactivo del Catastro Minero SERNAGEOMIN.
 * Muestra en vivo los polígonos de pertenencias (Explotación 1983 / 1932,
 * Exploración 1983, Estacamento) en el bbox visible, más las concesiones
 * registradas del proyecto.
 */
export function CatastroMap({ concessions, center = [-71.115, -33.898], projectName, onFeaturesLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const catastroLayerRef = useRef<LeafletGeoJSON | null>(null);
  const projectLayerRef = useRef<LeafletGeoJSON | null>(null);
  const invalidateTimersRef = useRef<number[]>([]);
  const isUnmountingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [LRef, setLRef] = useState<typeof LType | null>(null);
  const featuresRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Per-feature leaflet layers, keyed by stable feature id, for select-on-click highlight.
  const featureLayersRef = useRef<Map<string, LType.Layer>>(new Map());
  // Visible features mirrored to React state so the side panel can render & filter.
  const [visibleFeatures, setVisibleFeatures] = useState<GeoJSON.Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const FILTER_STORAGE_KEY = "catastroMap:filters:v1";
  type SortMode = "default" | "ha_desc" | "ha_asc";
  type StoredFilters = { types?: CatastroOrigen[]; q?: string; expiringOnly?: boolean; sort?: SortMode };
  const loadStoredFilters = (): StoredFilters => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredFilters) : {};
    } catch {
      return {};
    }
  };
  const [typeFilter, setTypeFilter] = useState<Set<CatastroOrigen>>(() => {
    const stored = loadStoredFilters();
    if (stored.types && Array.isArray(stored.types) && stored.types.length > 0) {
      return new Set<CatastroOrigen>(stored.types);
    }
    return new Set<CatastroOrigen>(["EXPLOTA_1983", "EXPLOTA_1932", "EXPLORA_1983", "ESTACAMENTO"]);
  });
  const [searchQuery, setSearchQuery] = useState(() => loadStoredFilters().q ?? "");
  const [expiringOnly, setExpiringOnly] = useState(() => loadStoredFilters().expiringOnly ?? false);
  const [sortMode, setSortMode] = useState<SortMode>(() => loadStoredFilters().sort ?? "default");
  const expiryThresholdDays = 90;

  // Persist filter state across reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: StoredFilters = {
        types: Array.from(typeFilter),
        q: searchQuery,
        expiringOnly,
        sort: sortMode,
      };
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
    } catch { /* quota / disabled storage */ }
  }, [typeFilter, searchQuery, expiringOnly, sortMode]);

  const featureId = (f: GeoJSON.Feature, idx: number): string => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const rol = p.NUMERO_ROL ?? p.numero_rol;
    const dv = p.DV_ROL ?? p.dv_rol;
    if (rol != null) return `${rol}-${dv ?? ""}-${idx}`;
    return `f-${idx}`;
  };

  // Init map once
  useEffect(() => {
    // Reset unmount flag in case the previous render aborted (React StrictMode
    // or HMR can leave it stuck at `true` and silently disable invalidateSize).
    isUnmountingRef.current = false;
    if (!containerRef.current || mapRef.current) return;
    let aborted = false;
    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        // Don't abort just because StrictMode unmounted+remounted us — as long
        // as the container is still in the DOM we can safely (re)init. If the
        // container is gone, the cleanup below will tear everything down.
        if (aborted || !containerRef.current || !containerRef.current.isConnected) {
          console.warn("[CatastroMap] init skipped (container detached)");
          return;
        }
        if (mapRef.current) {
          // Another effect run already initialized the map; just publish L.
          setLRef(L);
          return;
        }

        const map = L.map(containerRef.current, {
          center: [center[1], center[0]],
          zoom: 12,
          zoomControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        });

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Imagery © Esri",
            maxZoom: 19,
          }
        ).addTo(map);

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
            opacity: 0.45,
          }
        ).addTo(map);

        mapRef.current = map;
        setLRef(L);

        // Fix: if the map mounts inside a dynamic layout, defer safe invalidation.
        const safeInvalidate = () => {
          if (isUnmountingRef.current) return;
          const currentMap = mapRef.current;
          const el = containerRef.current;
          if (!currentMap || !el || !el.isConnected) return;
          try {
            currentMap.invalidateSize(false);
          } catch {
            /* noop */
          }
        };

        requestAnimationFrame(safeInvalidate);
        invalidateTimersRef.current.push(window.setTimeout(safeInvalidate, 200));
        invalidateTimersRef.current.push(window.setTimeout(safeInvalidate, 600));

        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          ro = new ResizeObserver(() => {
            safeInvalidate();
          });
          ro.observe(containerRef.current);
        }
        (map as unknown as { __ro?: ResizeObserver | null }).__ro = ro;
      } catch (e) {
        console.error("[CatastroMap] failed to initialize Leaflet map", e);
      }
    })();
    return () => {
      aborted = true;
      isUnmountingRef.current = true;
      invalidateTimersRef.current.forEach((id) => window.clearTimeout(id));
      invalidateTimersRef.current = [];
      const m = mapRef.current as unknown as { __ro?: ResizeObserver | null } | null;
      m?.__ro?.disconnect();
      mapRef.current?.off();
      mapRef.current?.stop();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center]);

  // Render project concessions
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef;
    if (!map || !L) return;
    if (projectLayerRef.current) {
      projectLayerRef.current.remove();
      projectLayerRef.current = null;
    }
    const features = concessions
      .filter((c) => c.geometry_geojson)
      .map((c) => ({
        type: "Feature" as const,
        properties: { ...c },
        geometry: c.geometry_geojson as GeoJSON.Geometry,
      }));
    if (features.length === 0) return;
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    const layer = L.geoJSON(fc, {
      style: () => ({
        color: "#FFD24A",
        weight: 2,
        opacity: 1,
        fillColor: "#FFD24A",
        fillOpacity: 0.15,
        dashArray: "4,3",
      }),
      onEachFeature: (f, lyr) => {
        const p = f.properties as MiningConcession;
        lyr.bindPopup(
          `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:240px;">
            <strong style="color:#FFD24A;">${p.code} — ${p.name}</strong><br/>
            Tipo: ${p.concession_type}<br/>
            Estado: ${p.status}<br/>
            Titular: ${p.holder ?? "—"}<br/>
            Área: ${p.area_ha ?? "—"} ha<br/>
            Vence: ${p.expires_at ?? "—"}
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 Concesión registrada del proyecto</div>
          </div>`
        );
      },
    }).addTo(map);
    projectLayerRef.current = layer;
    try {
      const b = layer.getBounds();
      if (b.isValid() && !isUnmountingRef.current) {
        map.fitBounds(b, { padding: [40, 40], maxZoom: 14, animate: false });
      }
    } catch { /* noop */ }
  }, [concessions, LRef]);

  const [fromCache, setFromCache] = useState(false);

  // Render features into the leaflet layer (extracted so cache + fetch share it).
  const renderFeatures = (fc: GeoJSON.FeatureCollection) => {
    const map = mapRef.current;
    const L = LRef;
    if (!map || !L) return;
    if (catastroLayerRef.current) {
      catastroLayerRef.current.remove();
      catastroLayerRef.current = null;
    }
    featureLayersRef.current.clear();
    // Clip features to current view to keep tooltips snappy and assign stable ids.
    const b = map.getBounds();
    const view: BBox = { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() };
    const visible = (fc.features ?? [])
      .filter((f) => featureIntersectsBbox(f, view))
      .map((f, idx) => ({ ...f, id: featureId(f, idx) } as GeoJSON.Feature));
    const visibleFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: visible };
    const layer = L.geoJSON(visibleFc, {
      style: (feature) => {
        const origen = ((feature?.properties as Record<string, unknown> | undefined)?.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
        const s = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
        return {
          color: s.color,
          weight: s.weight,
          opacity: s.opacity,
          fillColor: s.fillColor,
          fillOpacity: s.fillOpacity,
        };
      },
      onEachFeature: (f, lyr) => {
        const id = (f.id as string) ?? "";
        if (id) featureLayersRef.current.set(id, lyr);
        lyr.bindPopup(catastroPopupHtml((f.properties ?? {}) as Record<string, unknown>), { maxWidth: 320 });
        lyr.on("dblclick", (ev: LType.LeafletMouseEvent) => {
          // Prevent the map's default double-click zoom when selecting.
          L.DomEvent.stopPropagation(ev);
          if (ev.originalEvent) L.DomEvent.preventDefault(ev.originalEvent);
          setSelectedId(id || null);
        });
      },
    }).addTo(map);
    catastroLayerRef.current = layer;
    featuresRef.current = visibleFc;
    setVisibleFeatures(visible);
    setCount(visible.length);
    setSelectedId(null);
    onFeaturesLoaded?.(visibleFc);
  };

  // Fetch SERNAGEOMIN catastro for the current bbox (cache-aware).
  const loadCatastro = async (opts?: { force?: boolean }) => {
    const map = mapRef.current;
    const L = LRef;
    if (!map || !L) return;
    const b = map.getBounds();
    const view: BBox = {
      minLng: b.getWest(),
      minLat: b.getSouth(),
      maxLng: b.getEast(),
      maxLat: b.getNorth(),
    };

    // 1) Try cache (any cached bbox covering current view)
    if (!opts?.force) {
      const hit = findCoveringCache(view);
      if (hit) {
        setErr(null);
        setFromCache(true);
        renderFeatures(hit.fc);
        return;
      }
    }

    // 2) Fetch — pad bbox to prefetch a buffer so small pans/zooms reuse cache
    setLoading(true);
    setErr(null);
    setFromCache(false);
    try {
      const fetchBbox = padBbox(view, 0.25);
      const url = catastroQueryUrl(fetchBbox);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SERNAGEOMIN HTTP ${res.status}`);
      const fc = (await res.json()) as GeoJSON.FeatureCollection;
      writeCache(fetchBbox, fc);
      renderFeatures(fc);
    } catch (e) {
      setErr((e as Error).message);
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on map ready + on moveend (debounced, cache-first)
  useEffect(() => {
    const map = mapRef.current;
    if (!LRef || !map) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loadCatastro(), 350);
    };
    trigger(); // initial
    map.on("moveend", trigger);
    return () => {
      if (timer) clearTimeout(timer);
      map.off("moveend", trigger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LRef]);

  const clearCache = () => {
    memoryCache.clear();
    if (typeof window !== "undefined") {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
        }
        keys.forEach((k) => window.localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    toast.success("Caché de catastro limpiado");
    loadCatastro({ force: true });
  };

  // Apply visual highlight: selection state + expiry warning ring.
  useEffect(() => {
    if (!LRef) return;
    for (const [id, lyr] of featureLayersRef.current.entries()) {
      const path = lyr as unknown as { setStyle?: (s: Record<string, unknown>) => void };
      if (!path.setStyle) continue;
      const f = visibleFeatures.find((x) => x.id === id);
      const props = (f?.properties as Record<string, unknown> | undefined) ?? {};
      const origen = (props.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
      const s = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
      const sev = expirySeverity(daysUntilExpiry(props));
      const isSel = selectedId === id;
      const isDimmed = selectedId !== null && !isSel;
      // Expiring polygons get a red outline + slightly higher fill so they pop.
      const expiringStroke = sev === "expired" || sev === "critical" || sev === "warn";
      const ringColor = sev !== "ok" && sev !== "unknown" ? EXPIRY_COLOR[sev] : null;
      path.setStyle({
        color: isSel ? "#ffffff" : ringColor ?? s.color,
        weight: isSel ? 4 : expiringStroke ? 3 : s.weight,
        opacity: isDimmed ? 0.35 : s.opacity,
        fillColor: ringColor ?? s.fillColor,
        fillOpacity: isSel
          ? Math.min(0.55, s.fillOpacity + 0.25)
          : isDimmed
          ? 0.05
          : expiringStroke
          ? Math.min(0.5, s.fillOpacity + 0.15)
          : s.fillOpacity,
        dashArray: sev === "expired" ? "6,4" : undefined,
      });
    }
  }, [selectedId, visibleFeatures, LRef]);

  // Pan to selected feature.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const lyr = featureLayersRef.current.get(selectedId) as unknown as { getBounds?: () => LType.LatLngBounds };
    if (lyr?.getBounds) {
      try {
        const b = lyr.getBounds();
        if (b.isValid() && !isUnmountingRef.current) {
          map.fitBounds(b, { padding: [60, 60], maxZoom: 16, animate: false });
        }
      } catch { /* noop */ }
    }
  }, [selectedId]);

  // Filtered + sorted list (type + free-text + expiring-only) for the side panel.
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = visibleFeatures.filter((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const origen = (p.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
      if (!typeFilter.has(origen)) return false;
      if (expiringOnly) {
        const sev = expirySeverity(daysUntilExpiry(p));
        if (sev !== "expired" && sev !== "critical" && sev !== "warn") return false;
      }
      if (!q) return true;
      const hay = [p.NOMBRE, p.NUMERO_ROL, p.TITULAR_DIVISION, p.COMUNA]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" | ");
      return hay.includes(q);
    });
    if (sortMode === "default") return filtered;
    const ha = (f: GeoJSON.Feature): number => {
      const v = (f.properties as Record<string, unknown> | undefined)?.HECTAREAS;
      return typeof v === "number" && Number.isFinite(v) ? v : -Infinity;
    };
    return [...filtered].sort((a, b) =>
      sortMode === "ha_desc" ? ha(b) - ha(a) : ha(a) - ha(b),
    );
  }, [visibleFeatures, typeFilter, searchQuery, expiringOnly, sortMode]);

  // Expiry summary across visible features (independent of filters).
  const expirySummary = useMemo(() => {
    let expired = 0, critical = 0, warn = 0;
    for (const f of visibleFeatures) {
      const sev = expirySeverity(daysUntilExpiry((f.properties ?? {}) as Record<string, unknown>));
      if (sev === "expired") expired++;
      else if (sev === "critical") critical++;
      else if (sev === "warn") warn++;
    }
    return { expired, critical, warn };
  }, [visibleFeatures]);


  const toggleType = (t: CatastroOrigen) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const handleExportPdf = async () => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    setExporting(true);
    try {
      const b = map.getBounds();
      await exportCatastroMapPdf({
        mapElement: el,
        bbox: { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
        zoom: map.getZoom(),
        catastroFeatures: (featuresRef.current?.features ?? []).map((f) => ({
          properties: (f.properties ?? {}) as Parameters<typeof exportCatastroMapPdf>[0]["catastroFeatures"][number]["properties"],
        })),
        projectConcessions: concessions,
        projectName,
      });
      toast.success("PDF exportado");
    } catch (e) {
      toast.error(`No se pudo exportar: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="border border-border rounded overflow-hidden bg-bg-secondary/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-mono uppercase tracking-wider text-text-secondary truncate">Catastro SERNAGEOMIN</span>
          {count !== null && (
            <span className="font-mono text-signal-cyan whitespace-nowrap">{count} en vista</span>
          )}
          {fromCache && !loading && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary border border-border whitespace-nowrap" title="Datos servidos desde caché local (24h)">
              <Database className="w-3 h-3 inline mr-1" />caché
            </span>
          )}
          {err && <span className="text-destructive truncate">· {err}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={clearCache}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-bg-elevated text-xs hover:bg-accent disabled:opacity-50"
            title="Limpiar caché y refrescar"
          >
            Limpiar caché
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-bg-elevated text-xs hover:bg-accent disabled:opacity-50"
            title="Exportar mapa actual a PDF"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
          <button
            onClick={() => loadCatastro({ force: true })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
            title="Forzar recarga desde SERNAGEOMIN"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Recargar
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div ref={containerRef} className="h-[420px] md:h-[520px] w-full" />
        <aside className="border-t lg:border-t-0 lg:border-l border-border bg-bg-secondary/50 flex flex-col h-[300px] lg:h-[520px]">
          <div className="px-3 py-2 border-b border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                Pertenencias en vista
              </span>
              <div className="flex items-center gap-1.5">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-bg-elevated focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Ordenar listado"
                >
                  <option value="default">Orden: original</option>
                  <option value="ha_desc">Ha ↓ (mayor)</option>
                  <option value="ha_asc">Ha ↑ (menor)</option>
                </select>
                <span className="font-mono text-[10px] text-signal-cyan">
                  {filteredFeatures.length}/{visibleFeatures.length}
                </span>
              </div>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ROL, titular, comuna…"
                className="w-full pl-7 pr-7 py-1 text-xs font-mono rounded border border-border bg-bg-elevated focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.entries(CATASTRO_STYLE) as Array<[CatastroOrigen, typeof CATASTRO_STYLE[CatastroOrigen]]>).map(([k, s]) => {
                const active = typeFilter.has(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleType(k)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-opacity ${
                      active ? "opacity-100" : "opacity-40"
                    }`}
                    style={{
                      borderColor: s.color,
                      background: active ? `${s.fillColor}` : "transparent",
                      color: active ? s.color : "var(--text-secondary)",
                    }}
                    title={`${active ? "Ocultar" : "Mostrar"} ${s.label}`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-sm"
                      style={{ background: s.fillColor, border: `1px solid ${s.color}` }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
            {(expirySummary.expired + expirySummary.critical + expirySummary.warn) > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/50">
                <button
                  onClick={() => setExpiringOnly((v) => !v)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                    expiringOnly ? "bg-destructive/15 border-destructive text-destructive" : "border-border text-text-secondary hover:bg-accent"
                  }`}
                  title={`Mostrar solo pertenencias que vencen en ≤${expiryThresholdDays} días`}
                >
                  ⚠ Solo por vencer
                </button>
                {expirySummary.expired > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded animate-pulse" style={{ background: `${EXPIRY_COLOR.expired}22`, color: EXPIRY_COLOR.expired, border: `1px solid ${EXPIRY_COLOR.expired}` }}>
                    {expirySummary.expired} vencidas
                  </span>
                )}
                {expirySummary.critical > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${EXPIRY_COLOR.critical}22`, color: EXPIRY_COLOR.critical, border: `1px solid ${EXPIRY_COLOR.critical}` }}>
                    {expirySummary.critical} ≤30 d
                  </span>
                )}
                {expirySummary.warn > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${EXPIRY_COLOR.warn}22`, color: EXPIRY_COLOR.warn, border: `1px solid ${EXPIRY_COLOR.warn}` }}>
                    {expirySummary.warn} ≤90 d
                  </span>
                )}
              </div>
            )}
          </div>
          {selectedId && (() => {
            const sel = visibleFeatures.find((f) => f.id === selectedId);
            if (!sel) return null;
            const p = (sel.properties ?? {}) as Record<string, unknown>;
            const origen = (p.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
            const s = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
            const rol = `${(p.NUMERO_ROL as string | number) ?? "—"}${p.DV_ROL ? `-${String(p.DV_ROL)}` : ""}`;
            const ha = typeof p.HECTAREAS === "number" ? p.HECTAREAS.toFixed(2) : "—";
            const days = daysUntilExpiry(p);
            const sev = expirySeverity(days);
            const venc = p.FECHA_VENCIMIENTO
              ? new Date(typeof p.FECHA_VENCIMIENTO === "number" ? p.FECHA_VENCIMIENTO : String(p.FECHA_VENCIMIENTO)).toLocaleDateString("es-CL")
              : null;
            const openPopup = () => {
              const map = mapRef.current;
              const lyr = featureLayersRef.current.get(selectedId) as unknown as {
                openPopup?: () => void;
                getBounds?: () => LType.LatLngBounds;
              };
              if (!map || !lyr) return;
              try {
                if (lyr.getBounds) {
                  const b = lyr.getBounds();
                  if (b.isValid() && !isUnmountingRef.current) {
                    map.fitBounds(b, { padding: [60, 60], maxZoom: 16, animate: false });
                  }
                }
                lyr.openPopup?.();
              } catch { /* noop */ }
            };
            const rows: Array<[string, string]> = [
              ["Origen", s.label],
              ["ROL", rol],
              ["Nombre", (p.NOMBRE as string) ?? "—"],
              ["Titular", (p.TITULAR_DIVISION as string) ?? "—"],
              ["Comuna", (p.COMUNA as string) ?? "—"],
              ["Superficie", `${ha} ha`],
              ["Situación", (p.SITUACION_CONCESION as string) ?? "—"],
              ...(venc ? [["Vencimiento", venc] as [string, string]] : []),
            ];
            return (
              <div
                className="border-b border-border bg-bg-elevated/60 px-3 py-2.5 space-y-2"
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      Detalle seleccionado
                    </div>
                    <div className="font-mono text-xs font-semibold truncate" style={{ color: s.color }}>
                      {(p.NOMBRE as string) ?? "(sin nombre)"}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="shrink-0 text-text-secondary hover:text-foreground"
                    aria-label="Cerrar detalle"
                    title="Cerrar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <dl className="space-y-1">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[10px] font-mono leading-tight">
                      <dt className="text-text-secondary min-w-[68px] shrink-0">{k}</dt>
                      <dd className="font-medium text-foreground break-words">{v}</dd>
                    </div>
                  ))}
                  {sev !== "ok" && sev !== "unknown" && days !== null && (
                    <div className="flex gap-2 text-[10px] font-mono leading-tight">
                      <dt className="text-text-secondary min-w-[68px] shrink-0">Estado</dt>
                      <dd
                        className={`font-medium ${sev === "expired" ? "animate-pulse" : ""}`}
                        style={{ color: EXPIRY_COLOR[sev] }}
                      >
                        {sev === "expired" ? `Vencida hace ${Math.abs(days)} d` : `Vence en ${days} d`}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      const map = mapRef.current;
                      const lyr = featureLayersRef.current.get(selectedId) as unknown as {
                        getBounds?: () => LType.LatLngBounds;
                      };
                      if (!map || !lyr?.getBounds) return;
                      try {
                        const b = lyr.getBounds();
                        if (b.isValid() && !isUnmountingRef.current) {
                          map.fitBounds(b, { padding: [40, 40], maxZoom: 17, animate: false });
                        }
                      } catch { /* noop */ }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-primary/40 bg-primary/10 text-[10px] font-mono text-primary hover:bg-primary/20"
                    title="Hacer zoom y centrar en la pertenencia seleccionada"
                  >
                    <Crosshair className="w-3 h-3" />
                    Zoom y centrar
                  </button>
                  <button
                    onClick={openPopup}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-border bg-bg-secondary text-[10px] font-mono hover:bg-accent"
                    title="Centrar y abrir popup en el mapa"
                  >
                    <Search className="w-3 h-3" />
                    Ver popup
                  </button>
                </div>
              </div>
            );
          })()}
          <div className="flex-1 overflow-y-auto">
            {filteredFeatures.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-secondary font-mono">
                {visibleFeatures.length === 0 ? "Sin pertenencias en vista" : "Ningún resultado con esos filtros"}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredFeatures.map((f) => {
                  const id = f.id as string;
                  const p = (f.properties ?? {}) as Record<string, unknown>;
                  const origen = (p.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
                  const s = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
                  const isSel = selectedId === id;
                  const days = daysUntilExpiry(p);
                  const sev = expirySeverity(days);
                  const showBadge = sev === "expired" || sev === "critical" || sev === "warn";
                  const badgeColor = showBadge ? EXPIRY_COLOR[sev as "expired" | "critical" | "warn"] : null;
                  return (
                    <li key={id}>
                      <button
                        onClick={() => setSelectedId(isSel ? null : id)}
                        className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent transition-colors ${
                          isSel ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="inline-block w-2 h-2 rounded-sm shrink-0"
                            style={{ background: s.fillColor, border: `1px solid ${s.color}` }}
                          />
                          <span className="font-semibold truncate flex-1" style={{ color: s.color }}>
                            {(p.NOMBRE as string) ?? "(sin nombre)"}
                          </span>
                          {showBadge && badgeColor && (
                            <span
                              className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-mono ${sev === "expired" ? "animate-pulse" : ""}`}
                              style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}` }}
                              title={
                                sev === "expired"
                                  ? `Vencida hace ${Math.abs(days ?? 0)} días`
                                  : `Vence en ${days} días`
                              }
                            >
                              {sev === "expired" ? "VENCIDA" : `${days}d`}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-secondary leading-tight">
                          ROL {(p.NUMERO_ROL as string | number) ?? "—"}
                          {p.DV_ROL ? `-${String(p.DV_ROL)}` : ""} · {typeof p.HECTAREAS === "number" ? p.HECTAREAS.toFixed(1) : "—"} ha
                          {p.COMUNA ? ` · ${String(p.COMUNA)}` : ""}
                        </div>
                        {typeof p.TITULAR_DIVISION === "string" && p.TITULAR_DIVISION && (
                          <div className="text-[10px] text-text-secondary truncate mt-0.5">
                            {p.TITULAR_DIVISION}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
      <div className="flex flex-wrap gap-3 px-3 py-2 border-t border-border text-[10px] font-mono">
        {(Object.entries(CATASTRO_STYLE) as Array<[CatastroOrigen, typeof CATASTRO_STYLE[CatastroOrigen]]>).map(([k, s]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.fillColor, border: `1px solid ${s.color}` }} />
            <span className="text-text-secondary">{s.label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#FFD24A33", border: "1.5px dashed #FFD24A" }} />
          <span className="text-text-secondary">Mis concesiones</span>
        </span>
      </div>
    </div>
  );
}
