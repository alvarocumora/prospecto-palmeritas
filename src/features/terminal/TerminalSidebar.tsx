import { Link, useRouterState } from "@tanstack/react-router";
import { TrendingUp, Briefcase, Coins, HandCoins, Settings, Map } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const items = [
  { label: "Proyectos", to: "/terminal", icon: Map, hash: undefined as string | undefined },
  {
    label: "Mercado",
    to: "/terminal/market",
    icon: TrendingUp,
    hash: undefined as string | undefined,
  },
  { label: "Portafolio", to: "/terminal", icon: Briefcase, hash: "portfolio" as string | undefined },
  {
    label: "Participaciones",
    to: "/terminal/tokenize",
    icon: Coins,
    hash: undefined as string | undefined,
  },
  {
    label: "Capital",
    to: "/terminal/capital-raise",
    icon: HandCoins,
    hash: undefined as string | undefined,
  },
] as const;

export function TerminalSidebar() {
  const location = useRouterState({ select: (s) => s.location });
  return (
    <aside className="hidden md:flex w-14 lg:w-48 shrink-0 border-r border-border bg-card/30 flex-col">
      <div className="h-10 flex items-center px-3 border-b border-border">
        <Link to="/terminal" aria-label="Inicio del terminal" className="block">
          <Logo size={18} textClassName="text-[11px] hidden lg:inline" />
        </Link>
      </div>
      <nav className="flex-1 py-2">
        {items.map((it) => {
          const Icon = it.icon;
          const active = location.pathname === it.to && (location.hash || undefined) === it.hash;
          return (
            <Link
              key={it.label}
              title={it.label}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              to={it.to}
              hash={it.hash}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                active && "text-gold bg-muted/30 border-l-2 border-gold",
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">Dashboard</span>
        </Link>
      </div>
    </aside>
  );
}
