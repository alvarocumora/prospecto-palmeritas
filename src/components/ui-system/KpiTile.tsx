import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ficha de indicador (KPI) uniforme para toda la plataforma. */
export function KpiTile({
  label,
  value,
  sub,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** delta con signo (verde/rojo), p.ej. "+3.2%" */
  trend?: { value: string; positive: boolean };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {trend && (
          <span className={cn("text-xs font-semibold", trend.positive ? "text-signal-green" : "text-signal-red")}>
            {trend.value}
          </span>
        )}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Fila de KPIs responsiva. */
export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
