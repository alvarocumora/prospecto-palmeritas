import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type RailItem = {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
  group?: string;
  exact?: boolean;
};

export function CommandRail({
  items,
  footer,
  brand,
}: {
  items: RailItem[];
  footer?: ReactNode;
  brand?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const location = useLocation();
  const groups = items.reduce<Record<string, RailItem[]>>((acc, it) => {
    const g = it.group ?? "—";
    (acc[g] ??= []).push(it);
    return acc;
  }, {});
  const expanded = hover;

  return (
    <aside
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "hidden md:flex fixed top-9 bottom-6 left-0 z-30 flex-col bg-bg-panel border-r border-border transition-[width] duration-150 ease-out overflow-hidden",
        expanded ? "w-56" : "w-12",
      )}
      aria-label="Command rail"
    >
      {brand && (
        <div className={cn("h-10 flex items-center border-b border-border shrink-0", expanded ? "px-3" : "justify-center")}>
          {brand}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-1.5 scrollbar-none">
        {Object.entries(groups).map(([group, list]) => (
          <div key={group} className="mb-1">
            {expanded && group !== "—" && (
              <div className="px-3 pt-2 pb-1 text-[9px] font-mono uppercase tracking-[0.12em] text-text-dim">
                {group}
              </div>
            )}
            {list.map((it) => {
              const active = it.exact
                ? location.pathname === it.to
                : location.pathname === it.to || location.pathname.startsWith(it.to + "/");
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  title={it.label}
                  className={cn(
                    "group relative flex items-center gap-2.5 h-8 mx-1 px-2.5 rounded-[2px] font-mono text-[11px] transition-colors",
                    active
                      ? "bg-bg-elevated text-signal-cyan border-l-2 border-signal-cyan -ml-px pl-[9px]"
                      : "text-text-mono hover:bg-bg-elevated hover:text-foreground",
                  )}
                >
                  <span className="shrink-0 w-4 h-4 inline-flex items-center justify-center">{it.icon}</span>
                  <span
                    className={cn(
                      "truncate transition-opacity",
                      expanded ? "opacity-100" : "opacity-0 pointer-events-none",
                    )}
                  >
                    {it.label}
                  </span>
                  {it.badge && it.badge > 0 ? (
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-[2px] bg-signal-amber/20 text-signal-amber text-[9px] font-bold tabular-nums border border-signal-amber/40",
                        !expanded && "absolute right-1 top-1 min-w-[8px] h-2 p-0 border-0 bg-signal-amber",
                      )}
                    >
                      {expanded ? (it.badge > 99 ? "99+" : it.badge) : ""}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {footer && (
        <div className={cn("border-t border-border shrink-0", expanded ? "p-2" : "p-1.5")}>
          {footer}
        </div>
      )}
    </aside>
  );
}
