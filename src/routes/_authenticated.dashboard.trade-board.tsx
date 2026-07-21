import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutGrid, ArrowLeft, ExternalLink } from "lucide-react";
import { listMyTrades } from "@/lib/trades.functions";
import { buildTradeBoard, boardSummary, type BoardTrade } from "@/lib/tradeBoard";

export const Route = createFileRoute("/_authenticated/dashboard/trade-board")({
  head: () => ({ meta: [{ title: "Tablero de trades — Geocapitals" }] }),
  component: TradeBoardPage,
});

const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

function TradeBoardPage() {
  const listFn = useServerFn(listMyTrades);
  const { data, isLoading } = useQuery({
    queryKey: ["my-trades"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const trades = (data ?? []) as unknown as BoardTrade[];
  const columns = buildTradeBoard(trades);
  const summary = boardSummary(trades);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <Link
          to="/dashboard/trades"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Trade Desk
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Tablero de trades</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          El flujo comercial completo en una pizarra: cada operación avanza de columna en columna.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
        <Kpi label="Activos" value={String(summary.activeCount)} />
        <Kpi label="Pipeline" value={usd(summary.pipelineUsd)} />
        <Kpi label="Cerrados" value={String(summary.closedCount)} />
        <Kpi label="Cancelados" value={String(summary.cancelledCount)} tone="muted" />
      </div>

      {isLoading ? (
        <div className="h-64 rounded bg-muted/20 animate-pulse" />
      ) : trades.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aún no hay trades. Créalos en el Trade Desk.
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-3 min-w-max">
            {columns.map((col) => (
              <div key={col.key} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {col.cards.length}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground px-1 mb-2">
                  {col.totalUsd > 0 ? usd(col.totalUsd) : ""}
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {col.cards.map((c) => (
                    <Link
                      key={c.id}
                      to="/dashboard/trades/$tradeId"
                      params={{ tradeId: c.id }}
                      className="group block rounded-md border border-border bg-bg-secondary/30 p-2.5 hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {c.reference ?? "Trade"}
                        </span>
                        <span
                          className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded shrink-0 ${
                            c.role === "buyer"
                              ? "bg-blue-500/15 text-blue-600"
                              : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {c.role === "buyer" ? "compra" : "venta"}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {c.commodity ?? "—"}
                        {c.quantity_t != null ? ` · ${c.quantity_t} t` : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.counterparty}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-mono">{usd(c.total_value_usd)}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                      {/* Avance documental */}
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${c.docPct}%` }}
                          title={`Avance documental ${c.docPct}%`}
                        />
                      </div>
                    </Link>
                  ))}
                  {col.cards.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/60 p-3 text-[10px] text-muted-foreground text-center">
                      —
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-lg font-semibold font-mono ${tone === "muted" ? "text-muted-foreground" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
