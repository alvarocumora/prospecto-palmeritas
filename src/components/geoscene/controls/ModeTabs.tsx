import { Mountain, Layers, Box } from "lucide-react";
import { MODE_LABELS, type GeoSceneMode } from "../types";

const ICONS: Record<GeoSceneMode, typeof Mountain> = {
  surface: Mountain,
  subsurface: Layers,
  resource: Box,
};

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: GeoSceneMode;
  onChange: (m: GeoSceneMode) => void;
}) {
  const modes: GeoSceneMode[] = ["surface", "subsurface", "resource"];
  return (
    <div className="inline-flex items-center rounded border border-border bg-bg-secondary/95 backdrop-blur overflow-hidden shadow-md">
      {modes.map((m) => {
        const Icon = ICONS[m];
        const active = m === mode;
        const meta = MODE_LABELS[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono transition-colors border-l border-border first:border-l-0 ${
              active
                ? "bg-gold text-background"
                : "text-foreground hover:bg-accent"
            }`}
            title={meta.sub}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
