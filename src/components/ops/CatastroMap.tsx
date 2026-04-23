import { useEffect, useRef, useState } from "react";
import { Database, Download, Loader2, RefreshCw } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [LRef, setLRef] = useState<typeof LType | null>(null);
  const featuresRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center[1], center[0]],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Imagery © Esri",
          maxZoom: 19,
        }
      ).addTo(map);

      L.tileLayer(
        "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
        { attribution: "Labels © Stamen", maxZoom: 18, opacity: 0.85 }
      ).addTo(map);

      mapRef.current = map;
      setLRef(L);
    })();
    return () => {
      cancelled = true;
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
      if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
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
    // Clip features to current view to keep tooltips snappy.
    const b = map.getBounds();
    const view: BBox = { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() };
    const visible = (fc.features ?? []).filter((f) => featureIntersectsBbox(f, view));
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
        lyr.bindPopup(catastroPopupHtml((f.properties ?? {}) as Record<string, unknown>), { maxWidth: 320 });
      },
    }).addTo(map);
    catastroLayerRef.current = layer;
    featuresRef.current = visibleFc;
    setCount(visible.length);
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
          {err && <span className="text-destructive truncate">· {err}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
            onClick={loadCatastro}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Cargar
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-[420px] md:h-[520px] w-full" />
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
