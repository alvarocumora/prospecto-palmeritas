import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type RailItem = {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
  group?: string;
  exact?: boolean;
};

const PIN_KEY = "ops:rail:pinned:v1";
const COLLAPSED_GROUPS_KEY = "ops:rail:collapsed-groups:v1";

export function CommandRail({
  items,
  footer,
  brand,
  topSlot,
}: {
  items: RailItem[];
  footer?: ReactNode;
  brand?: ReactNode;
  topSlot?: ReactNode;
}) {
  const location = useLocation();
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Hydrate persisted state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = window.localStorage.getItem(PIN_KEY);
      if (p === "1") setPinned(true);
      const g = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (g) setCollapsedGroups(new Set(JSON.parse(g) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [pinned]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COLLAPSED_GROUPS_KEY,
        JSON.stringify(Array.from(collapsedGroups)),
      );
    } catch {
      /* ignore */
    }
  }, [collapsedGroups]);

  const expanded = pinned || hover;

  // Preserve original group ordering by tracking first appearance.
  const groupOrder: string[] = [];
  const groups: Record<string, RailItem[]> = {};
  for (const it of items) {
    const g = it.group ?? "—";
    if (!(g in groups)) {
      groups[g] = [];
      groupOrder.push(g);
    }
    groups[g].push(it);
  }

  const toggleGroup = (g: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  return (
    <aside
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "hidden md:flex fixed top-9 bottom-6 left-0 z-30 flex-col bg-bg-panel border-r border-border transition-[width] duration-200 ease-out overflow-hidden",
        expanded ? "w-60" : "w-14",
      )}
      aria-label="Command rail"
    >
      {brand && (
        <div
          className={cn(
            "h-10 flex items-center border-b border-border shrink-0",
            expanded ? "px-3" : "justify-center",
          )}
        >
          {brand}
        </div>
      )}

      {topSlot && expanded && <div className="shrink-0">{topSlot}</div>}

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {groupOrder.map((group, gi) => {
          const list = groups[group];
          const hasGroupLabel = group !== "—";
          const isCollapsed = collapsedGroups.has(group);
          const groupHasActive = list.some((it) =>
            it.exact
              ? location.pathname === it.to
              : location.pathname === it.to || location.pathname.startsWith(it.to + "/"),
          );
          const showItems = !hasGroupLabel || !expanded || !isCollapsed || groupHasActive;

          return (
            <div key={group} className={cn("mb-1", gi > 0 && expanded && hasGroupLabel && "mt-2")}>
              {expanded && hasGroupLabel && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-3 pt-1.5 pb-1 text-[9px] font-mono uppercase tracking-[0.14em] text-text-dim hover:text-text-mono transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <span>{group}</span>
                  <span
                    className={cn(
                      "transition-transform text-[8px]",
                      isCollapsed ? "" : "rotate-90",
                    )}
                  >
                    ›
                  </span>
                </button>
              )}
              {showItems &&
                list.map((it) => {
                  const active = it.exact
                    ? location.pathname === it.to
                    : location.pathname === it.to || location.pathname.startsWith(it.to + "/");
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      title={it.label}
                      aria-label={it.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center h-8 mx-1.5 rounded-[3px] font-mono text-[11px] transition-colors",
                        expanded ? "gap-2.5 px-2.5" : "justify-center px-0",
                        active
                          ? "bg-bg-elevated text-signal-cyan"
                          : "text-text-mono hover:bg-bg-elevated/70 hover:text-foreground",
                      )}
                    >
                      {/* Active indicator bar */}
                      <span
                        className={cn(
                          "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm bg-signal-cyan transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="shrink-0 w-4 h-4 inline-flex items-center justify-center">
                        {it.icon}
                      </span>
                      {expanded && (
                        <>
                          <span className="truncate">{it.label}</span>
                          {it.badge && it.badge > 0 ? (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-[2px] bg-signal-amber/15 text-signal-amber text-[9px] font-bold tabular-nums border border-signal-amber/40">
                              {it.badge > 99 ? "99+" : it.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                      {!expanded && it.badge && it.badge > 0 ? (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-signal-amber" />
                      ) : null}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* Pin / unpin */}
      <div
        className={cn(
          "border-t border-border shrink-0 flex",
          expanded ? "px-2 py-1.5 justify-end" : "p-1.5 justify-center",
        )}
      >
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          className="inline-flex items-center justify-center w-7 h-6 rounded-[2px] text-text-dim hover:text-foreground hover:bg-bg-elevated transition-colors"
          title={pinned ? "Soltar barra (auto-collapse)" : "Fijar barra abierta"}
          aria-label={pinned ? "Soltar barra" : "Fijar barra"}
        >
          {pinned ? (
            <ChevronsLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronsRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {footer && (
        <div className={cn("border-t border-border shrink-0", expanded ? "p-2" : "p-1.5")}>
          {footer}
        </div>
      )}
    </aside>
  );
}
