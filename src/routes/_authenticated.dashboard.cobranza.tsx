import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, AlertTriangle, CalendarClock, ArrowUpRight, Inbox } from "lucide-react";
import { getReceivablesOverview, type ReceivablesSide } from "@/lib/receivables.functions";
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  type AgingBucket,
  type ReceivableItem,
} from "@/lib/receivables";

export const Route = createFileRoute("/_authenticated/dashboard/cobranza")({
  head: () => ({ meta: [{ title: "Cobranza — Geocapitals" }] }),
  component: CobranzaPage,
});

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-CL")}`;
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "2-digit" })
    : "—";

const BUCKET_TONE: Record<AgingBucket, string> = {
  current: "text-text-secondary",
  d1_30: "text-amber-600",
  d31_60: "text-orange-600",
  d61_90: "text-red-600",
  d90_plus: "text-red-700 font-semibold",
};

type SideKey = "cobrar" | "pagar";

function CobranzaPage() {
  const fn = useServerFn(getReceivablesOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["receivables-overview"],
    queryFn: () => fn(),
    staleTime: 2 * 60_000,
  });
  const [side, setSide] = useState<SideKey>("cobrar");

  const active = side === "cobrar" ? data?.cobrar : data?.pagar;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Cobranza</h1>
      </div>
      <p className="text-sm text-text-secondary -mt-2">
        Cartera de todos tus trades: qué está por cobrar, qué está vencido y hace cuánto.
      </p>

      {/* Tabs por cobrar / por pagar */}
      <div className="flex items-center gap-1 border-b border-border">
        {(
          [
            ["cobrar", "Por cobrar", data?.cobrar.summary.outstandingUsd ?? 0],
            ["pagar", "Por pagar", data?.pagar.summary.outstandingUsd ?? 0],
          ] as Array<[SideKey, string, number]>
        ).map(([key, label, total]) => (
          <button
            key={key}
            onClick={() => setSide(key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              side === key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}{" "}
            <span className="text-[11px] font-mono text-muted-foreground">({usd(total)})</span>
          </button>
        ))}
      </div>

      {data?.pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          El módulo de pagos aún no está activo. La cartera aparecerá cuando se aplique la última
          migración de <code>trade_payments</code>.
        </div>
      )}

      {isLoading ? (
        <div className="h-64 rounded bg-muted/20 animate-pulse" />
      ) : active ? (
        <SideView side={active} kind={side} />
      ) : null}
    </div>
  );
}

function SideView({ side, kind }: { side: ReceivablesSide; kind: SideKey }) {
  const s = side.summary;
  const cobrar = kind === "cobrar";
  const totalLabel = cobrar ? "Total por cobrar" : "Total por pagar";
  const cpHeader = cobrar ? "Cliente" : "Proveedor";

  if (s.count === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-10 text-center">
        <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <div className="text-sm text-foreground mb-0.5">
          Sin pendientes {cobrar ? "por cobrar" : "por pagar"}
        </div>
        <div className="text-xs text-muted-foreground">
          Los cronogramas de pago de tus trades aparecerán aquí.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label={totalLabel}
          value={usd(s.outstandingUsd)}
          sub={`${s.count} pendiente${s.count === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Vencido"
          value={usd(s.overdueUsd)}
          sub={`${s.overdueCount} vencido${s.overdueCount === 1 ? "" : "s"}`}
          tone={s.overdueUsd > 0 ? "danger" : "muted"}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
        />
        <Kpi
          label="Vigente"
          value={usd(Math.max(0, s.outstandingUsd - s.overdueUsd))}
          sub="Aún no vencido"
        />
        <Kpi
          label="Próximo vencimiento"
          value={s.nextDue ? usd(s.nextDue.amountUsd) : "—"}
          sub={
            s.nextDue ? `${s.nextDue.label} · ${fmtDate(s.nextDue.dueDate)}` : "Sin fechas próximas"
          }
          icon={<CalendarClock className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Aging por tramos */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Antigüedad de saldos (aging)
        </div>
        <div className="grid grid-cols-5 gap-2">
          {AGING_BUCKETS.map((b) => (
            <div key={b} className="rounded border border-border bg-background p-2.5 text-center">
              <div className="text-[10px] text-muted-foreground mb-1">{AGING_BUCKET_LABELS[b]}</div>
              <div className={`text-sm font-mono ${BUCKET_TONE[b]}`}>{usd(s.buckets[b])}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Por contraparte */}
        <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Saldo por {cpHeader.toLowerCase()}
          </div>
          <div className="space-y-1.5">
            {side.byCounterparty.map((c) => (
              <div
                key={c.counterpartyKey}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm truncate">{c.counterpartyLabel}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.count} pago{c.count === 1 ? "" : "s"}
                    {c.overdueUsd > 0 && (
                      <span className="text-red-600"> · {usd(c.overdueUsd)} vencido</span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-mono shrink-0">{usd(c.outstandingUsd)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Detalle de pendientes */}
        <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Pendientes ({side.items.length})
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {[...side.items]
              .sort((a, b) => b.daysOverdue - a.daysOverdue)
              .map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: ReceivableItem }) {
  return (
    <Link
      to="/dashboard/trades/$tradeId"
      params={{ tradeId: item.tradeId }}
      className="group flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-muted/30 border-b border-border/40 last:border-0"
    >
      <div className="min-w-0">
        <div className="text-sm truncate flex items-center gap-1.5">
          {item.label ?? item.kind}
          <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {item.counterpartyLabel} · {item.tradeLabel}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-mono">{usd(item.amountUsd)}</div>
        <div className="text-[11px]">
          {item.overdue ? (
            <span className="text-red-600">Vencido {item.daysOverdue}d</span>
          ) : (
            <span className="text-muted-foreground">Vence {fmtDate(item.dueDate)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "muted";
  icon?: React.ReactNode;
}) {
  const valueTone =
    tone === "danger"
      ? "text-red-600"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-semibold font-mono ${valueTone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
