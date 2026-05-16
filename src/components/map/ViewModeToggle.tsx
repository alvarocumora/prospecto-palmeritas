import { Map as Map2DIcon, Box } from "lucide-react";

export type ViewMode = "2d" | "3d";

export function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded border border-border bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("2d")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono transition-colors ${
          mode === "2d" ? "bg-gold text-background" : "text-foreground hover:bg-accent"
        }`}
        title="Vista 2D Leaflet"
      >
        <Map2DIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">2D</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("3d")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono border-l border-border transition-colors ${
          mode === "3d" ? "bg-gold text-background" : "text-foreground hover:bg-accent"
        }`}
        title="Vista 3D MapLibre + deck.gl"
      >
        <Box className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">3D</span>
      </button>
    </div>
  );
}
