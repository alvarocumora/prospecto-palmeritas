import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Handshake, FileSignature, Menu, Compass, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Slot = {
  to?: string;
  search?: Record<string, string>;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  onClick?: () => void;
  matchPrefix?: boolean;
};

export function MobileBottomNav({
  onMoreClick,
  catastroAlerts = 0,
  variant = "default",
}: {
  onMoreClick: () => void;
  catastroAlerts?: number;
  /** "investor": navegación contextual de 4 destinos para rol inversionista. */
  variant?: "default" | "investor";
}) {
  const location = useLocation();

  if (variant === "investor") {
    const slots: Slot[] = [
      { to: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
      { to: "/proyectos", icon: Compass, label: "Explorar" },
      { to: "/dashboard/investments", icon: Briefcase, label: "Portafolio" },
      {
        to: "/dashboard/investments",
        search: { vista: "wallet" },
        icon: Wallet,
        label: "Wallet",
      },
    ];
    return (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-surface/95 backdrop-blur border-t border-hairline flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="navigation"
        aria-label="Navegación del inversionista"
      >
        {slots.map((s) => {
          const Icon = s.icon;
          const active = location.pathname === s.to;
          return (
            <Link
              key={s.label}
              to={s.to}
              search={s.search as never}
              className="relative flex-1 min-h-[44px] flex flex-col items-center justify-center active:scale-95 transition-transform"
            >
              <span
                className={cn(
                  "absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full transition-colors",
                  active ? "bg-accent-brand" : "bg-transparent",
                )}
              />
              <Icon className={cn("w-5 h-5", active ? "text-accent-brand" : "text-content-subtle")} />
              <span
                className={cn(
                  "text-[10px] font-mono mt-0.5",
                  active ? "text-accent-brand" : "text-content-subtle",
                )}
              >
                {s.label}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Deals-first: el negocio a un tap; mapa/3D/catastro viven en "Más".
  const slots: Slot[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { to: "/dashboard/deals", icon: Briefcase, label: "Deals", matchPrefix: true },
    { to: "/dashboard/trades", icon: Handshake, label: "Trades", matchPrefix: true },
    { to: "/dashboard/documentos", icon: FileSignature, label: "Docs", matchPrefix: true },
    { icon: Menu, label: "Más", onClick: onMoreClick, badge: catastroAlerts },
  ];

  const isActive = (s: Slot) => {
    if (!s.to) return false;
    if (s.matchPrefix)
      return location.pathname === s.to || location.pathname.startsWith(s.to + "/");
    return location.pathname === s.to;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-bg-panel/95 backdrop-blur border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      role="navigation"
      aria-label="Navegación principal"
    >
      {slots.map((s, i) => {
        const Icon = s.icon;
        const active = isActive(s);
        const inner = (
          <>
            <span
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-opacity",
                active ? "bg-signal-cyan opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "w-5 h-5 transition-colors",
                active ? "text-signal-cyan" : "text-text-dim",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-mono mt-0.5 transition-colors",
                active ? "text-signal-cyan" : "text-text-dim",
              )}
            >
              {s.label}
            </span>
            {s.badge && s.badge > 0 ? (
              <span className="absolute top-1 right-1/2 translate-x-[18px] min-w-[14px] h-3.5 px-1 rounded-full bg-signal-amber text-background text-[9px] font-bold leading-[14px] text-center tabular-nums">
                {s.badge > 9 ? "9+" : s.badge}
              </span>
            ) : null}
          </>
        );
        const className =
          "relative flex-1 flex flex-col items-center justify-center active:scale-95 transition-transform";
        if (s.to) {
          return (
            <Link key={i} to={s.to} className={className}>
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={s.onClick}
            className={className}
            aria-label={s.label}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
