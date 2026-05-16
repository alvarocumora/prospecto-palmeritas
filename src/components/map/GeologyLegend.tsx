import { useState } from "react";
import { ChevronDown, ChevronUp, Mountain, Sparkles } from "lucide-react";
import type { GeologyLegendEntry } from "./geologyFeatureLayers";

type Props = {
  hostRock: GeologyLegendEntry[];
  alteration: GeologyLegendEntry[];
};

export function GeologyLegend({ hostRock, alteration }: Props) {
  const [open, setOpen] = useState(true);

  if (hostRock.length === 0 && alteration.length === 0) {
    return (
      <span className="text-muted-foreground/70 font-mono text-[11px]">
        Sin unidades geológicas mapeadas en este proyecto.
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1 font-mono text-[11px] border border-border/40 rounded-md bg-surface-1/40 backdrop-blur px-2 py-1.5 max-w-[420px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-text-secondary hover:text-foreground transition-colors"
      >
        <span className="uppercase tracking-wider text-[10px] text-text-dim">Geología</span>
        <span className="text-text-dim">·</span>
        <span>{hostRock.length} host rock</span>
        <span className="text-text-dim">·</span>
        <span>{alteration.length} alteración</span>
        {open ? (
          <ChevronUp className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-1">
          {hostRock.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase text-text-dim mb-0.5">
                <Mountain className="w-3 h-3" /> Host rock
              </div>
              {hostRock.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-1.5"
                  title={`${e.label}${e.sub ? ` · ${e.sub}` : ""} (${e.count})`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm border border-border/60 shrink-0"
                    style={{ background: e.color }}
                  />
                  <span className="text-text-secondary truncate">{e.label}</span>
                  <span className="text-text-dim ml-auto">{e.count}</span>
                </div>
              ))}
            </div>
          )}
          {alteration.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase text-text-dim mb-0.5">
                <Sparkles className="w-3 h-3" /> Alteración
              </div>
              {alteration.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-1.5"
                  title={`${e.label}${e.sub ? ` · ${e.sub}` : ""} (${e.count})`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm border border-border/60 shrink-0"
                    style={{ background: e.color, opacity: 0.85 }}
                  />
                  <span className="text-text-secondary truncate">{e.label}</span>
                  <span className="text-text-dim ml-auto">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
