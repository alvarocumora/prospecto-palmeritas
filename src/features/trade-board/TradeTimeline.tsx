// Vista timeline (Gantt liviana) del tablero: cada trade es una barra desde
// created_at hasta hoy, coloreada por etapa. Sólo lectura; para editar se
// vuelve al Kanban. Usa el mismo dataset filtrado.
import type { BoardTrade } from "@/lib/tradeBoard";
import { TRADE_STAGES, type TradeStage } from "@/lib/tradeDocuments";
import { Link } from "@tanstack/react-router";

const STAGE_COLOR: Record<string, string> = {
  icpo: "bg-slate-400",
  fco: "bg-blue-400",
  spa: "bg-indigo-400",
  payment: "bg-amber-400",
  shipping: "bg-orange-400",
  delivered: "bg-emerald-400",
  closed: "bg-emerald-600",
};

const STAGE_LABEL = Object.fromEntries(TRADE_STAGES.map((s) => [s.key, s.label])) as Record<
  TradeStage,
  string
>;

export function TradeTimeline({ trades }: { trades: BoardTrade[] }) {
  const active = trades.filter((t) => t.status !== "cancelled");
  if (active.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-hairline p-10 text-center text-sm text-muted-foreground">
        Sin trades activos.
      </div>
    );
  }
  const now = Date.now();
  const starts = active
    .map((t) => new Date(t.created_at ?? Date.now()).getTime())
    .filter((n) => Number.isFinite(n));
  const min = Math.min(...starts, now - 30 * 86_400_000);
  const total = Math.max(now - min, 86_400_000);

  const fmtDate = (n: number) => new Date(n).toISOString().slice(0, 10);
  const ticks = 5;

  return (
    <div className="rounded-md border border-hairline bg-surface p-3 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="relative h-6 mb-2 border-b border-hairline">
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const t = min + (total * i) / ticks;
            return (
              <div
                key={i}
                className="absolute top-0 h-full text-[9px] font-mono text-muted-foreground"
                style={{ left: `${(i / ticks) * 100}%` }}
              >
                <div className="h-full border-l border-hairline pl-1">{fmtDate(t)}</div>
              </div>
            );
          })}
        </div>
        <div className="space-y-1">
          {active.map((t) => {
            const start = new Date(t.created_at ?? Date.now()).getTime();
            const left = ((start - min) / total) * 100;
            const width = Math.max(1, ((now - start) / total) * 100);
            const color = STAGE_COLOR[t.stage] ?? "bg-muted";
            return (
              <Link
                key={t.id}
                to="/dashboard/trades/$tradeId"
                params={{ tradeId: t.id }}
                className="block group"
              >
                <div className="relative h-6 rounded hover:bg-muted/30">
                  <div
                    className={`absolute top-1 h-4 rounded-sm ${color} opacity-80 group-hover:opacity-100`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${t.reference ?? "Trade"} · ${STAGE_LABEL[t.stage as TradeStage] ?? t.stage}`}
                  />
                  <div
                    className="absolute top-0.5 text-[10px] font-mono whitespace-nowrap px-1 pointer-events-none"
                    style={{ left: `calc(${Math.min(left + width, 85)}% + 4px)` }}
                  >
                    <span className="text-foreground/80">
                      {t.reference ?? "Trade"} · {t.commodity ?? "—"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
