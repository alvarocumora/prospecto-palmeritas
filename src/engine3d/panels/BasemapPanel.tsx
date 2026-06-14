// Panel HUD "Mapa Base / GIS": controles de basemap, opacidad, escala y norte.
import { Globe2, Compass } from "lucide-react";
import type { BasemapSource } from "@/engine3d/terrain/basemapTiles";

type Status = { source: BasemapSource; failed: boolean; zoom: number } | null;

type Props = {
  source: BasemapSource;
  onSource: (s: BasemapSource) => void;
  opacity: number;
  onOpacity: (n: number) => void;
  ve: number;
  onVe: (n: number) => void;
  showCoords: boolean;
  onShowCoords: (b: boolean) => void;
  showScaleBar: boolean;
  onShowScaleBar: (b: boolean) => void;
  showNorth: boolean;
  onShowNorth: (b: boolean) => void;
  centerLng: number;
  centerLat: number;
  extentMeters: number;
  status: Status;
};

const SOURCES: { id: BasemapSource; label: string }[] = [
  { id: "esri", label: "ESRI Satellite" },
  { id: "osm", label: "OpenStreetMap" },
  { id: "topo", label: "Topographic" },
  { id: "none", label: "None" },
];

export function BasemapPanel({
  source,
  onSource,
  opacity,
  onOpacity,
  ve,
  onVe,
  showCoords,
  onShowCoords,
  showScaleBar,
  onShowScaleBar,
  showNorth,
  onShowNorth,
  centerLng,
  centerLat,
  extentMeters,
  status,
}: Props) {
  const noCenter = centerLng === 0 && centerLat === 0;
  return (
    <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2">
      <div className="flex items-center gap-2">
        <Globe2 className="w-3 h-3 text-cyan-400" />
        <span className="uppercase tracking-wider text-cyan-300">Mapa Base / GIS</span>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => onSource(s.id)}
            className={`px-2 py-1 rounded border text-[9px] uppercase tracking-wider ${
              source === s.id
                ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                : "border-border bg-black/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {noCenter && (
        <div className="text-amber-300 text-[9px]">
          ⚠ Sin centro geográfico — basemap desactivado.
        </div>
      )}

      {status && (
        <div className="text-[9px] text-muted-foreground">
          src <span className="text-cyan-300">{status.source}</span> · z={status.zoom}
          {status.failed && <span className="text-amber-300"> · tiles parciales</span>}
        </div>
      )}

      <label className="block text-[9px] uppercase tracking-wider text-muted-foreground">
        opacidad basemap · {opacity.toFixed(2)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={opacity}
        onChange={(e) => onOpacity(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />

      <label className="block text-[9px] uppercase tracking-wider text-muted-foreground">
        exageración vertical · {ve.toFixed(1)}×
      </label>
      <input
        type="range"
        min={1}
        max={6}
        step={0.5}
        value={ve}
        onChange={(e) => onVe(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />

      <div className="grid grid-cols-3 gap-1 pt-1">
        <Toggle label="Coords" active={showCoords} onChange={onShowCoords} />
        <Toggle label="Escala" active={showScaleBar} onChange={onShowScaleBar} />
        <Toggle label="Norte" active={showNorth} onChange={onShowNorth} />
      </div>

      <div className="text-[9px] text-muted-foreground pt-1 border-t border-border/50">
        centro {centerLat.toFixed(5)}, {centerLng.toFixed(5)} · extent {extentMeters}m
      </div>
    </div>
  );
}

function Toggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`px-1.5 py-1 rounded border text-[9px] uppercase tracking-wider ${
        active
          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
          : "border-border bg-black/40 text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/** Mini brújula 2D para esquina inferior-derecha. */
export function NorthArrow() {
  return (
    <div className="absolute bottom-3 right-3 z-10 bg-black/60 backdrop-blur rounded-full w-12 h-12 flex items-center justify-center border border-border">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <Compass className="w-8 h-8 text-cyan-300/80" />
        <span className="absolute -top-0.5 text-[9px] font-mono text-cyan-200">N</span>
      </div>
    </div>
  );
}

/** Barra de escala simple proporcional al extent en pantalla. */
export function ScaleBar({ extentMeters }: { extentMeters: number }) {
  // Muestra una barra de 1/4 del extent
  const segment = Math.round(extentMeters / 4);
  const label = segment >= 1000 ? `${(segment / 1000).toFixed(1)} km` : `${segment} m`;
  return (
    <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur rounded px-2 py-1 border border-border text-[10px] font-mono text-foreground/90 flex items-center gap-2">
      <div className="h-2 w-24 border-l border-r border-t border-cyan-300/80 relative">
        <div className="absolute inset-x-0 top-1 border-t border-cyan-300/80" />
      </div>
      <span className="text-cyan-200">{label}</span>
    </div>
  );
}
