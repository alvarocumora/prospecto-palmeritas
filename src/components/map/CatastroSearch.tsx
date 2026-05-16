import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import type { GeoJSON as LeafletGeoJSON, Map as LeafletMap } from "leaflet";
import { searchCatastroByCode, summarizeHit, type CatastroHit } from "./searchCatastro";
import type { LeafletNS } from "./types";

interface Props {
  map: LeafletMap | null;
  L: LeafletNS | null;
}

/**
 * Buscador flotante de concesiones SERNAGEOMIN por CODIGO o ROL.
 * Al seleccionar un resultado: dibuja la geometría, hace fitBounds y abre
 * un popup con titular y área.
 */
export function CatastroSearch({ map, L }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<CatastroHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<LeafletGeoJSON | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Limpia el highlight al desmontar
  useEffect(() => {
    return () => {
      if (highlightRef.current && map) {
        map.removeLayer(highlightRef.current);
        highlightRef.current = null;
      }
    };
  }, [map]);

  // Foco automático al abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setHits([]);
    try {
      const results = await searchCatastroByCode(term);
      setHits(results);
      if (results.length === 0) setError("Sin resultados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de búsqueda");
    } finally {
      setLoading(false);
    }
  }

  function selectHit(hit: CatastroHit) {
    if (!map || !L) return;
    if (highlightRef.current) {
      map.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }
    const s = summarizeHit(hit);
    const popupHtml = `
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;max-width:260px;">
        <div style="color:#F0C96B;font-weight:600;margin-bottom:4px;">${escapeHtml(s.nombre)}</div>
        <div><span style="color:#A89080;">Código:</span> <strong>${escapeHtml(s.codigo)}</strong></div>
        <div><span style="color:#A89080;">ROL:</span> ${escapeHtml(s.rol)}</div>
        <div><span style="color:#A89080;">Titular:</span> ${escapeHtml(s.titular)}</div>
        <div><span style="color:#A89080;">Área:</span> ${
          s.areaHa != null ? `${Number(s.areaHa).toLocaleString("es-CL")} ha` : "—"
        }</div>
        <div><span style="color:#A89080;">Vigencia:</span> ${escapeHtml(s.vigencia)}</div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">
          ${hit.layerLabel} · SERNAGEOMIN
        </div>
      </div>`;

    const layer = L.geoJSON(
      { type: "Feature", geometry: hit.geometry, properties: hit.properties } as GeoJSON.Feature,
      {
        style: {
          color: "#F0C96B",
          weight: 3,
          opacity: 1,
          fillColor: "#F0C96B",
          fillOpacity: 0.25,
        },
      },
    );
    layer.bindPopup(popupHtml, { maxWidth: 300 });
    layer.addTo(map);
    highlightRef.current = layer;

    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      layer.openPopup();
    } catch {
      // ignore
    }
  }

  function clearAll() {
    setTerm("");
    setHits([]);
    setError(null);
    if (highlightRef.current && map) {
      map.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-3 left-3 z-[500] inline-flex items-center gap-2 px-3 h-9 rounded border border-border bg-background/95 backdrop-blur text-foreground hover:bg-accent shadow-md transition-colors text-xs font-mono"
        title="Buscar concesión por CODIGO o ROL"
      >
        <Search className="w-3.5 h-3.5" />
        Buscar concesión
      </button>
    );
  }

  return (
    <div className="absolute top-3 left-3 z-[500] w-72 rounded border border-border bg-background/95 backdrop-blur shadow-lg text-xs font-mono">
      <form onSubmit={runSearch} className="flex items-center gap-1 p-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          maxLength={64}
          placeholder="CODIGO o ROL (ej. 0301-1234)"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />}
        <button
          type="button"
          onClick={() => {
            clearAll();
            setOpen(false);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>

      {error && (
        <div className="px-2 py-1.5 text-[10px] text-destructive border-b border-border">
          {error}
        </div>
      )}

      {hits.length > 0 && (
        <ul className="max-h-64 overflow-y-auto">
          {hits.map((h, i) => {
            const s = summarizeHit(h);
            return (
              <li key={`${h.layer}-${s.codigo}-${i}`}>
                <button
                  type="button"
                  onClick={() => selectHit(h)}
                  className="w-full text-left px-2 py-1.5 hover:bg-accent border-b border-border/50 last:border-b-0 transition-colors"
                >
                  <div className="text-foreground font-semibold truncate">{s.nombre}</div>
                  <div className="text-muted-foreground text-[10px] flex items-center gap-2">
                    <span>{s.codigo}</span>
                    <span>·</span>
                    <span>{s.titular}</span>
                  </div>
                  <div className="text-muted-foreground/70 text-[10px]">
                    {s.areaHa != null
                      ? `${Number(s.areaHa).toLocaleString("es-CL")} ha`
                      : "sin área"}{" "}
                    · {h.layerLabel}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
