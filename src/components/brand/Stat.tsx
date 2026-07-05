import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Métrica: cifra mono prominente + etiqueta + pista opcional, sobre card. */
export function Stat({
  value,
  label,
  hint,
  icon: Icon,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
}) {
  return (
    <div className={cn("rounded-brand-md border border-hairline bg-surface-3 p-5", className)}>
      {Icon ? <Icon className="mb-4 size-5 text-accent-brand" strokeWidth={1.5} /> : null}
      <div className="font-mono text-3xl tracking-tight text-content">{value}</div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-content-subtle">{label}</div>
      {hint ? <div className="mt-1 font-mono text-[11px] text-content-muted">{hint}</div> : null}
    </div>
  );
}
