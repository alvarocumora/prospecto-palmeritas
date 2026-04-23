import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type * as LType from "leaflet";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { catastroQueryUrl, CATASTRO_STYLE, catastroPopupHtml, type CatastroOrigen } from "@/components/map/overlays";
import type { MiningConcession } from "@/hooks/useMiningConcessions";
import { exportCatastroMapPdf } from "@/lib/pdf/catastro-map";

type Props = {
  concessions: MiningConcession[];
  /** [lng, lat] center fallback */
  center?: [number, number];
  projectName?: string;
};

/**
 * Mapa interactivo del Catastro Minero SERNAGEOMIN.
 * Muestra en vivo los polígonos de pertenencias (Explotación 1983 / 1932,
 * Exploración 1983, Estacamento) en el bbox visible, más las concesiones
 * registradas del proyecto.
 */
export function CatastroMap({ concessions, center = [-71.115, -33.898] }: Props) {
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

  // Fetch SERNAGEOMIN catastro for the current bbox
  const loadCatastro = async () => {
    const map = mapRef.current;
    const L = LRef;
    if (!map || !L) return;
    setLoading(true);
    setErr(null);
    try {
      const b = map.getBounds();
      const url = catastroQueryUrl({
        minLng: b.getWest(),
        minLat: b.getSouth(),
        maxLng: b.getEast(),
        maxLat: b.getNorth(),
      });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SERNAGEOMIN HTTP ${res.status}`);
      const fc = (await res.json()) as GeoJSON.FeatureCollection;
      if (catastroLayerRef.current) {
        catastroLayerRef.current.remove();
        catastroLayerRef.current = null;
      }
      const layer = L.geoJSON(fc, {
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
      featuresRef.current = fc;
      setCount(fc.features?.length ?? 0);
    } catch (e) {
      setErr((e as Error).message);
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on first map ready
  useEffect(() => {
    if (LRef && mapRef.current) {
      const t = setTimeout(() => loadCatastro(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LRef]);

  return (
    <div className="border border-border rounded overflow-hidden bg-bg-secondary/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono uppercase tracking-wider text-text-secondary">Catastro SERNAGEOMIN</span>
          {count !== null && (
            <span className="font-mono text-signal-cyan">{count} pertenencias en vista</span>
          )}
          {err && <span className="text-destructive">· {err}</span>}
        </div>
        <button
          onClick={loadCatastro}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Cargar en vista
        </button>
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
