import { Pickaxe, Ship, Landmark, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleInfo, ModuleKey } from "@/hooks/useMyModules";

const ICONS: Record<string, LucideIcon> = {
  pickaxe: Pickaxe,
  ship: Ship,
  landmark: Landmark,
  "layout-dashboard": LayoutGrid,
};

/**
 * Compact module chip switcher. Rendered at the top of the CommandRail.
 * When only one module is available (single-module plan) it renders as a static badge.
 */
export function ModuleSwitcher({
  modules,
  selected,
  onSelect,
  locale = "es",
  className,
}: {
  modules: ModuleInfo[];
  selected: ModuleKey | "all";
  onSelect: (m: ModuleKey | "all") => void;
  locale?: "es" | "en";
  className?: string;
}) {
  if (!modules || modules.length === 0) return null;
  const single = modules.length === 1;

  return (
    <div className={cn("px-2 py-2 border-b border-border/60", className)}>
      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-text-dim mb-1.5 px-1">
        {locale === "es" ? "Módulo" : "Module"}
      </div>
      <div className="flex flex-col gap-1">
        {!single && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className={cn(
              "flex items-center gap-2 h-7 px-2 rounded-[2px] text-[11px] font-mono transition-colors",
              selected === "all"
                ? "bg-signal-cyan/15 text-signal-cyan border-l-2 border-signal-cyan"
                : "text-text-mono hover:bg-bg-elevated",
            )}
          >
            <LayoutGrid className="w-3 h-3" />
            <span className="truncate">{locale === "es" ? "Todos" : "All"}</span>
          </button>
        )}
        {modules.map((m) => {
          const Icon = (m.icon && ICONS[m.icon]) || LayoutGrid;
          const active = selected === m.key || single;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              title={locale === "es" ? (m.description_es ?? "") : (m.description_en ?? "")}
              className={cn(
                "flex items-center gap-2 h-7 px-2 rounded-[2px] text-[11px] font-mono transition-colors text-left",
                active
                  ? "bg-signal-cyan/15 text-signal-cyan border-l-2 border-signal-cyan"
                  : "text-text-mono hover:bg-bg-elevated",
              )}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{locale === "es" ? m.name_es : m.name_en}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
