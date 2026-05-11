import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SectionTitleProps = {
  icon?: LucideIcon;
  children: ReactNode;
  sub?: string;
};

export function SectionTitle({ icon: Icon, children, sub }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-gold" />}
        <h2 className="font-mono text-lg uppercase tracking-wider text-foreground">{children}</h2>
      </div>
      {sub && <span className="font-mono text-xs text-hint uppercase tracking-wider">{sub}</span>}
    </div>
  );
}
