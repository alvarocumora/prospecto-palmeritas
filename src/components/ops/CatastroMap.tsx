import { useEffect, useMemo, useRef, useState } from "react";
import { Database, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
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

  // Per-feature leaflet layers, keyed by stable feature id, for select-on-click highlight.
  const featureLayersRef = useRef<Map<string, LType.Layer>>(new Map());
  // Visible features mirrored to React state so the side panel can render & filter.
  const [visibleFeatures, setVisibleFeatures] = useState<GeoJSON.Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<CatastroOrigen>>(
    () => new Set<CatastroOrigen>(["EXPLOTA_1983", "EXPLOTA_1932", "EXPLORA_1983", "ESTACAMENTO"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const featureId = (f: GeoJSON.Feature, idx: number): string => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const rol = p.NUMERO_ROL ?? p.numero_rol;
    const dv = p.DV_ROL ?? p.dv_rol;
    if (rol != null) return `${rol}-${dv ?? ""}-${idx}`;
    return `f-${idx}`;
  };

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
        lyr.on("click", () => setSelectedId(id || null));
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

  // Apply visual highlight to the currently selected feature, dim the rest.
  useEffect(() => {
    if (!LRef) return;
    for (const [id, lyr] of featureLayersRef.current.entries()) {
      const path = lyr as unknown as { setStyle?: (s: Record<string, unknown>) => void };
      if (!path.setStyle) continue;
      const f = visibleFeatures.find((x) => x.id === id);
      const origen = ((f?.properties as Record<string, unknown> | undefined)?.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
      const s = CATASTRO_STYLE[origen] ?? CATASTRO_STYLE.EXPLOTA_1983;
      const isSel = selectedId === id;
      const isDimmed = selectedId !== null && !isSel;
      path.setStyle({
        color: isSel ? "#ffffff" : s.color,
        weight: isSel ? 4 : s.weight,
        opacity: isDimmed ? 0.35 : s.opacity,
        fillColor: s.fillColor,
        fillOpacity: isSel ? Math.min(0.55, s.fillOpacity + 0.25) : isDimmed ? 0.05 : s.fillOpacity,
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
        if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 16, animate: true });
      } catch { /* noop */ }
    }
  }, [selectedId]);

  // Filtered list (type + free-text) for the side panel.
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleFeatures.filter((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const origen = (p.ORIGEN as CatastroOrigen) ?? "EXPLOTA_1983";
      if (!typeFilter.has(origen)) return false;
      if (!q) return true;
      const hay = [p.NOMBRE, p.NUMERO_ROL, p.TITULAR_DIVISION, p.COMUNA]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" | ");
      return hay.includes(q);
    });
  }, [visibleFeatures, typeFilter, searchQuery]);

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
              <span className="font-mono text-[10px] text-signal-cyan">
                {filteredFeatures.length}/{visibleFeatures.length}
              </span>
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
          </div>
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
                          <span className="font-semibold truncate" style={{ color: s.color }}>
                            {(p.NOMBRE as string) ?? "(sin nombre)"}
                          </span>
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
