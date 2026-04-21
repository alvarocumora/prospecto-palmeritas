import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

export function MetricCell({
  label,
  value,
  unit,
  delta,
  trend,
  status,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  trend?: number[];
  status?: "ok" | "warn" | "crit" | "neutral" | "ai";
  className?: string;
}) {
  const valueColor =
    status === "warn" ? "text-signal-amber"
    : status === "crit" ? "text-signal-red"
    : status === "ok" ? "text-signal-green"
    : status === "ai" ? "text-signal-violet"
    : "text-foreground";
  const deltaColor =
    delta?.startsWith("+") ? "text-signal-green"
    : delta?.startsWith("-") ? "text-signal-red"
    : "text-text-dim";
  return (
    <div className={cn("ops-panel px-3 py-2 flex flex-col gap-1 min-w-0", className)}>
      <div className="text-[9px] font-mono uppercase tracking-[0.08em] text-text-dim truncate">{label}</div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <div className={cn("font-mono text-base leading-none font-semibold tabular-nums truncate", valueColor)}>
          {value}
        </div>
        {unit && <div className="text-[10px] font-mono text-text-dim">{unit}</div>}
      </div>
      {(delta || trend) && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {delta && <span className={cn("text-[10px] font-mono tabular-nums", deltaColor)}>{delta}</span>}
          {trend && trend.length > 0 && (
            <Sparkline data={trend} width={64} height={14} className={valueColor} />
          )}
        </div>
      )}
    </div>
  );
}
