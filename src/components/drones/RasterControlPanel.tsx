// Sprint 6.3 — Panel para controlar visibilidad/opacidad/colormap de cada raster en el mapa.
// Mantiene state local; el mapa lee el snapshot vía prop "settings".

import { Eye, EyeOff, Layers, Palette } from "lucide-react";
import type { DroneRaster } from "@/hooks/useDroneFlights";

export type RasterSettings = Record<string, {
  visible: boolean;
  opacity: number;
  colormap: "none" | "viridis" | "magma" | "terrain";
}>;

const COLORMAP_OPTS: Array<{ v: RasterSettings[string]["colormap"]; label: string }> = [
  { v: "none", label: "RGB" },
  { v: "viridis", label: "Viridis" },
  { v: "magma", label: "Magma" },
  { v: "terrain", label: "Terreno" },
];

const TYPE_BADGE: Record<string, { color: string; label: string }> = {
  ortho: { color: "#22c55e", label: "ORTHO" },
  dsm: { color: "#f59e0b", label: "DSM" },
  dtm: { color: "#a78bfa", label: "DTM" },
  chm: { color: "#84cc16", label: "CHM" },
  ndvi: { color: "#16a34a", label: "NDVI" },
  thermal: { color: "#ef4444", label: "TH" },
  multispectral: { color: "#06b6d4", label: "MS" },
  mag_grid: { color: "#a855f7", label: "MAG" },
  dem: { color: "#fb923c", label: "DEM" },
};

interface Props {
  rasters: DroneRaster[];
  settings: RasterSettings;
  onChange: (id: string, patch: Partial<RasterSettings[string]>) => void;
  onZoomTo: (r: DroneRaster) => void;
}

export function RasterControlPanel({ rasters, settings, onChange, onZoomTo }: Props) {
  if (rasters.length === 0) return null;

  return (
    <div className="absolute top-14 right-3 z-[600] pointer-events-none">
    <div className="pointer-events-auto w-72 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl max-h-[55vh] flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-gold" />
        <div className="text-[10px] font-mono uppercase text-muted-foreground">Rasters drone ({rasters.length})</div>
      </div>
      <div className="overflow-y-auto p-2 space-y-2">
        {rasters.map((r) => {
          const s = settings[r.id] ?? { visible: false, opacity: 0.75, colormap: "none" as const };
          const badge = TYPE_BADGE[r.raster_type] ?? { color: "#a8a29e", label: r.raster_type.toUpperCase().slice(0, 4) };
          const supportsColormap = ["dsm", "dtm", "chm", "ndvi", "thermal"].includes(r.raster_type);

          return (
            <div key={r.id} className="rounded border border-border bg-bg-secondary p-2">
              <div className="flex items-start gap-2 mb-1.5">
                <button
                  onClick={() => onChange(r.id, { visible: !s.visible })}
                  className={`mt-0.5 p-1 rounded ${s.visible ? "text-gold bg-gold/10" : "text-muted-foreground hover:bg-accent"}`}
                  aria-label={s.visible ? "Ocultar" : "Mostrar"}
                >
                  {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.5 rounded text-[8px] font-mono font-bold text-white" style={{ background: badge.color }}>{badge.label}</span>
                    <button
                      onClick={() => onZoomTo(r)}
                      className="text-xs font-mono font-semibold text-foreground hover:text-gold truncate text-left"
                      title="Zoom al raster"
                    >
                      {r.name}
                    </button>
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground truncate">
                    {r.captured_at ?? "—"}
                    {r.crs && ` · ${r.crs.replace(/^EPSG:/, "")}`}
                    {r.pixel_size_m && ` · ${r.pixel_size_m.toFixed(2)} m/px`}
                  </div>
                  {r.processing && (
                    <div className="text-[9px] font-mono text-warning mt-0.5">⏳ procesando metadata…</div>
                  )}
                </div>
              </div>

              {s.visible && (
                <div className="pl-7 space-y-1.5">
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-0.5">
                      <span>Opacidad</span>
                      <span className="text-foreground">{Math.round(s.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={s.opacity}
                      onChange={(e) => onChange(r.id, { opacity: Number(e.target.value) })}
                      className="w-full accent-gold h-1"
                    />
                  </div>
                  {supportsColormap && (
                    <div>
                      <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground mb-0.5">
                        <Palette className="w-2.5 h-2.5" /> Colormap
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {COLORMAP_OPTS.map((opt) => (
                          <button
                            key={opt.v}
                            onClick={() => onChange(r.id, { colormap: opt.v })}
                            className={`px-1 py-0.5 rounded text-[9px] font-mono ${s.colormap === opt.v ? "bg-gold text-bg-primary font-bold" : "border border-border text-muted-foreground hover:bg-accent"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[9px] font-mono text-muted-foreground">
        Click en nombre = zoom al raster
      </div>
    </div>
  );
}
