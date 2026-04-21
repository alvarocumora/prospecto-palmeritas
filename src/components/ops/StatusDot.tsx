import { cn } from "@/lib/utils";

export type SignalStatus = "live" | "ok" | "warn" | "crit" | "idle" | "ai";

const COLORS: Record<SignalStatus, string> = {
  live: "text-signal-cyan",
  ok: "text-signal-green",
  warn: "text-signal-amber",
  crit: "text-signal-red",
  idle: "text-text-dim",
  ai: "text-signal-violet",
};

export function StatusDot({
  status = "live",
  pulse = false,
  className,
  label,
}: {
  status?: SignalStatus;
  pulse?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px]", COLORS[status], className)}>
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full bg-current",
          pulse && "animate-pulse-dot",
        )}
        aria-hidden="true"
      />
      {label && <span className="uppercase tracking-wider">{label}</span>}
    </span>
  );
}
