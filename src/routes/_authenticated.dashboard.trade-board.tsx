import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { TradeBoardView } from "@/features/trade-board/TradeBoardView";

type BoardSearchParams = {
  q: string;
  role: "all" | "buyer" | "seller" | "desk";
  commodity: string;
  min: number | null;
  max: number | null;
  full: boolean;
  group: "none" | "role";
  view: "kanban" | "timeline";
};

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateSearch(raw: Record<string, unknown>): BoardSearchParams {
  const roleRaw = String(raw.role ?? "all");
  const role = (["all", "buyer", "seller", "desk"] as const).includes(
    roleRaw as BoardSearchParams["role"],
  )
    ? (roleRaw as BoardSearchParams["role"])
    : "all";
  return {
    q: typeof raw.q === "string" ? raw.q : "",
    role,
    commodity: typeof raw.commodity === "string" && raw.commodity ? raw.commodity : "all",
    min: toNum(raw.min),
    max: toNum(raw.max),
    full: raw.full === true || raw.full === "1" || raw.full === "true",
    group: raw.group === "role" ? "role" : "none",
    view: raw.view === "timeline" ? "timeline" : "kanban",
  };
}

export const Route = createFileRoute("/_authenticated/dashboard/trade-board")({
  head: () => ({ meta: [{ title: "Tablero de trades — Geocapitals" }] }),
  validateSearch,
  component: TradeBoardPage,
});

function TradeBoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard/trade-board" });

  const onSearchChange = (patch: Partial<BoardSearchParams>) => {
    navigate({
      search: (prev: BoardSearchParams) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  // Esc sale del fullscreen
  useEffect(() => {
    if (!search.full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSearchChange({ full: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.full]);

  return (
    <div className="p-4 md:p-6 space-y-3" data-theme="im-light">
      {!search.full && (
        <div>
          <Link
            to="/dashboard/trades"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Trade Desk
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            Arrastra cada tarjeta entre columnas para avanzar la etapa. Cambios en tiempo real.
          </p>
        </div>
      )}
      <TradeBoardView search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
