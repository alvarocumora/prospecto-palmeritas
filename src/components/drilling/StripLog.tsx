import { useMemo } from "react";
import type { DrillCoreLog } from "@/hooks/useDrilling";

/** Heat color for Au g/t value (null/0 → muted). */
function auColor(au: number | null | undefined): string {
  if (au == null || au <= 0) return "hsl(var(--muted-foreground) / 0.15)";
  if (au < 0.3) return "#1e3a8a"; // deep blue – sub-economic
  if (au < 0.5) return "#0891b2"; // teal
  if (au < 1) return "#84cc16"; // lime – cutoff zone
  if (au < 2) return "#facc15"; // yellow
  if (au < 5) return "#f97316"; // orange
  if (au < 10) return "#dc2626"; // red
  return "#7f1d1d"; // dark red – bonanza
}

/**
 * Vertical strip-log: one bar per interval, height proportional to interval length,
 * fill colored by Au g/t heat scale. Depth axis on the left.
 */
export function StripLog({
  logs,
  height = 600,
  width = 36,
}: {
  logs: DrillCoreLog[];
  height?: number;
  width?: number;
}) {
  const sorted = useMemo(
    () => [...logs].sort((a, b) => a.depth_from - b.depth_from),
    [logs]
  );

  const { min, max } = useMemo(() => {
    if (!sorted.length) return { min: 0, max: 1 };
    return {
      min: sorted[0].depth_from,
      max: sorted[sorted.length - 1].depth_to,
    };
  }, [sorted]);

  const span = Math.max(max - min, 0.01);
  const scale = (d: number) => ((d - min) / span) * height;

  // Build ~6 depth ticks
  const ticks = useMemo(() => {
    const n = 6;
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(min + (span * i) / n);
    return out;
  }, [min, span]);

  if (!sorted.length) return null;

  return (
    <div className="flex gap-1 select-none" style={{ height }}>
      {/* Depth axis */}
      <div className="relative text-[9px] font-mono text-text-secondary" style={{ width: 28 }}>
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute right-0 -translate-y-1/2 pr-1"
            style={{ top: scale(t) }}
          >
            {t.toFixed(0)}
          </div>
        ))}
      </div>

      {/* Strip column */}
      <div className="relative border border-border bg-bg-secondary rounded-sm overflow-hidden" style={{ width }}>
        {sorted.map((l) => {
          const top = scale(l.depth_from);
          const h = Math.max(scale(l.depth_to) - scale(l.depth_from), 1);
          const au = l.au_gpt;
          return (
            <div
              key={l.id}
              title={`${l.depth_from}–${l.depth_to} m · Au ${au ?? "—"} g/t${
                l.lithology ? ` · ${l.lithology}` : ""
              }`}
              className="absolute left-0 right-0 border-t border-background/40 hover:outline hover:outline-1 hover:outline-foreground/60 cursor-help"
              style={{ top, height: h, background: auColor(au) }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-col text-[9px] font-mono text-text-secondary gap-0.5 pl-1">
        <div className="font-semibold text-foreground">Au</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#7f1d1d" }} />≥10</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#dc2626" }} />5–10</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#f97316" }} />2–5</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#facc15" }} />1–2</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#84cc16" }} />0.5–1</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#0891b2" }} />0.3–0.5</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1e3a8a" }} />&lt;0.3</div>
        <div className="text-[8px] text-text-secondary/70 mt-1">g/t</div>
      </div>
    </div>
  );
}
