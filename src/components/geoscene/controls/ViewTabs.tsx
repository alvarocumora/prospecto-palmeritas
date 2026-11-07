import { Map as MapIcon, Box } from "lucide-react";
import type { ProjectView } from "@/lib/projects/navigation";

const LABEL: Record<ProjectView, string> = { "2d": "Planta", "3d": "Perspectiva" };
const ICONS: Record<ProjectView, typeof MapIcon> = { "2d": MapIcon, "3d": Box };

/** Planta/Perspectiva, mismo lenguaje visual que ModeTabs — vive en la
 * cabecera del visor en vez de flotar por su cuenta encima del canvas. */
export function ViewTabs({
  view,
  onChange,
}: {
  view: ProjectView;
  onChange: (v: ProjectView) => void;
}) {
  const views: ProjectView[] = ["2d", "3d"];
  return (
    <div className="inline-flex items-center rounded border border-border bg-bg-secondary/95 backdrop-blur overflow-hidden shadow-md">
      {views.map((v) => {
        const Icon = ICONS[v];
        const active = v === view;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono transition-colors border-l border-border first:border-l-0 ${
              active ? "bg-gold text-background" : "text-foreground hover:bg-accent"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{LABEL[v]}</span>
          </button>
        );
      })}
    </div>
  );
}
