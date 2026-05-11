import type { ReactNode } from "react";
import type { PalmerasTone } from "../../types";

type BadgeProps = {
  children: ReactNode;
  tone?: PalmerasTone;
};

const toneClasses: Record<PalmerasTone, string> = {
  gold: "bg-gold/15 text-gold border-gold/30",
  copper: "bg-copper/15 text-copper border-copper/30",
  teal: "bg-teal/15 text-teal border-teal/30",
  info: "bg-info/20 text-foreground border-info/40",
  alert: "bg-alert/20 text-foreground border-alert/40",
  muted: "bg-muted text-muted-foreground border-border",
};

export function Badge({ children, tone = "muted" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
