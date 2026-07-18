import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, TrendingUp, Clock, Percent, Banknote, Package, ArrowRight } from "lucide-react";
import { getBusinessAnalytics } from "@/lib/analytics.functions";

// Analítica del negocio: funnel comercial (requerimiento → propuesta →
// operación → cerrada), win rate, tiempo de ciclo, pipeline y finanzas.

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analítica del negocio — Geocapitals" }] }),
  component: AnalyticsPage,
});

const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`
    : `US$ ${Math.round(n).toLocaleString("es-CL")}`;

function AnalyticsPage() {
  const fn = useServerFn(getBusinessAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["business-analytics"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const topCount = data?.funnel[0]?.count ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Analítica del negocio</h1>
        </div>
        <p className="text-xs text-text-secondary mt-0.5">
          El funnel completo de tu operación: del requerimiento al cierre, con conversión, tiempo de
          ciclo y cobranza.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Percent className="w-4 h-4" />}
          label="Tasa de cierre"
          value={isLoading ? "…" : `${data?.winRatePct ?? 0}%`}
          hint="operaciones cerradas / abiertas"
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label="Ciclo promedio"
          value={isLoading ? "…" : `${data?.avgCycleDays ?? 0} d`}
          hint="de apertura a cierre"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Pipeline activo"
          value={isLoading ? "…" : fmtUsd(data?.pipeline.activeUsd ?? 0)}
          hint={`${fmtUsd(data?.pipeline.closedUsd ?? 0)} cerrado`}
        />
        <KpiCard
          icon={<Banknote className="w-4 h-4" />}
          label="Por cobrar"
          value={isLoading ? "…" : fmtUsd(data?.finance.outstandingUsd ?? 0)}
          hint={`${fmtUsd(data?.finance.receivedUsd ?? 0)} cobrado · ${fmtUsd(
            data?.finance.commissionsAccruedUsd ?? 0,
          )} comisiones`}
        />
      </div>

      {/* Funnel */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Funnel comercial
        </div>
        {isLoading ? (
          <div className="h-40 rounded bg-muted/20 animate-pulse" />
        ) : (
          <div className="space-y-3">
            {(data?.funnel ?? []).map((s, i) => {
              const widthPct = topCount > 0 ? Math.max(4, (s.count / topCount) * 100) : 4;
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{s.label}</span>
                    <span className="font-mono text-muted-foreground">
                      {s.count}
                      {i > 0 && <span className="ml-2 text-primary">{s.convFromPrevPct}% ↦</span>}
                    </span>
                  </div>
                  <div className="h-7 rounded bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-primary/70 flex items-center px-2"
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-[10px] font-mono text-primary-foreground">
                        {s.convFromTopPct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1">
              % junto a cada barra: conversión respecto al tope del funnel; «↦» es la conversión
              desde la etapa anterior.
            </p>
          </div>
        )}
      </section>

      {/* Top commodities */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-4">
          <Package className="w-3.5 h-3.5" /> Commodities por valor
        </div>
        {isLoading ? (
          <div className="h-24 rounded bg-muted/20 animate-pulse" />
        ) : (data?.topCommodities.length ?? 0) === 0 ? (
          <div className="text-xs text-text-secondary">
            Aún no hay operaciones. Cuando cierres trades aparecerán aquí por commodity.{" "}
            <Link to="/dashboard/trades" className="text-primary underline">
              Trade Desk
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const max = Math.max(...(data?.topCommodities ?? []).map((c) => c.valueUsd), 1);
              return (data?.topCommodities ?? []).map((c) => (
                <div key={c.commodity} className="flex items-center gap-3">
                  <span className="w-28 text-xs truncate">{c.commodity}</span>
                  <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-teal/60"
                      style={{ width: `${Math.max(4, (c.valueUsd / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-xs">{fmtUsd(c.valueUsd)}</span>
                  <span className="w-10 text-right text-[10px] text-muted-foreground">
                    {c.trades} op
                  </span>
                </div>
              ));
            })()}
          </div>
        )}
      </section>

      <Link
        to="/dashboard/trades"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Ir al Trade Desk <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="font-mono text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
