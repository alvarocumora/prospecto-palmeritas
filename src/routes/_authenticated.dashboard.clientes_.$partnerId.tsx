import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Network,
  Handshake,
  Coins,
  Mail,
  Phone,
  Globe,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { getPartnerHub } from "@/lib/partnerHub.functions";
import { computeNextActions, type NextActionPriority } from "@/lib/nextActions";
import { PARTNER_ROLE_LABELS, type PartnerRole } from "@/lib/clients";
import {
  COMMISSION_STATUS_LABELS,
  commissionAmount,
  type CommissionStatus,
} from "@/lib/commissions";
import { TRADE_STAGES } from "@/lib/tradeDocuments";

export const Route = createFileRoute("/_authenticated/dashboard/clientes_/$partnerId")({
  head: () => ({ meta: [{ title: "Hub de relación — Geocapitals" }] }),
  component: PartnerHubPage,
});

const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";
const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  TRADE_STAGES.map((s) => [s.key, s.label]),
);
const PRIORITY_DOT: Record<NextActionPriority, string> = {
  alta: "text-red-500",
  media: "text-amber-500",
  baja: "text-muted-foreground",
};

function PartnerHubPage() {
  const { partnerId } = Route.useParams();
  const fn = useServerFn(getPartnerHub);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-hub", partnerId],
    queryFn: () => fn({ data: { partnerId } }),
    staleTime: 30_000,
  });

  if (isLoading) return <div className="p-6 max-w-4xl h-40 rounded bg-muted/20 animate-pulse" />;
  if (!data) {
    return (
      <div className="p-6 max-w-4xl text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Contacto no encontrado</h1>
        <Link to="/dashboard/clientes" className="text-primary underline text-sm">
          Volver a Clientes y Asociados
        </Link>
      </div>
    );
  }

  const { partner: p, trades, commissions, summary } = data;
  const actions = computeNextActions({ trades, commissions, summary, now: new Date() });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <Link
        to="/dashboard/clientes"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Clientes y Asociados
      </Link>

      {/* Cabecera del socio */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">{p.name}</h1>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {PARTNER_ROLE_LABELS[(p.role as PartnerRole) ?? "otro"] ?? p.role}
          </span>
        </div>
        <div className="text-sm text-text-secondary mt-1">
          {[p.company, p.country].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Mail className="w-3 h-3" /> {p.email}
            </a>
          )}
          {p.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" /> {p.phone}
            </span>
          )}
          {p.commodities.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3 h-3" /> {p.commodities.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* KPIs de relación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Negocios activos" value={`${summary.activeCount} / ${summary.tradeCount}`} />
        <Kpi label="Pipeline" value={usd(summary.pipelineUsd)} />
        <Kpi label="Valor total deals" value={usd(summary.totalDealUsd)} />
        <Kpi
          label="Comisiones por cobrar"
          value={usd(summary.commissionsOutstandingUsd)}
          sub={`Devengado ${usd(summary.commissionsAccruedUsd)}`}
        />
      </div>

      {/* Próximas acciones (next-best-action) */}
      {actions.length > 0 && (
        <section className="rounded-md border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-primary mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Próximas acciones
          </div>
          <div className="space-y-2">
            {actions.map((a) => {
              const body = (
                <>
                  <span className={`shrink-0 mt-0.5 ${PRIORITY_DOT[a.priority]}`}>●</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {a.title}
                      {a.tradeId && (
                        <ArrowUpRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{a.detail}</div>
                  </div>
                </>
              );
              return a.tradeId ? (
                <Link
                  key={a.key}
                  to="/dashboard/trades/$tradeId"
                  params={{ tradeId: a.tradeId }}
                  className="flex items-start gap-2 rounded p-1.5 -m-1.5 hover:bg-primary/10"
                >
                  {body}
                </Link>
              ) : (
                <div key={a.key} className="flex items-start gap-2 p-1.5">
                  {body}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Recomendaciones automáticas por reglas. Pronto, asistidas por agentes de IA.
          </p>
        </section>
      )}

      {/* Trades del socio */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          <Handshake className="w-3.5 h-3.5" /> Operaciones ({trades.length})
        </div>
        {trades.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Sin operaciones con este contacto todavía. Vincúlalo a un trade desde el Trade Desk.
          </p>
        ) : (
          <div className="space-y-1.5">
            {trades.map((t) => (
              <Link
                key={t.id}
                to="/dashboard/trades/$tradeId"
                params={{ tradeId: t.id }}
                className="group flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-muted/30 border-b border-border/40 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm truncate flex items-center gap-1.5">
                    {t.reference ?? "Trade"}
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {t.commodity ?? "—"}
                    {t.quantity_t != null ? ` · ${t.quantity_t} t` : ""} ·{" "}
                    {STAGE_LABEL[t.stage] ?? t.stage}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono">{usd(t.total_value_usd)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {t.role === "buyer" ? "compra" : "venta"}
                    {t.status === "cancelled"
                      ? " · cancelado"
                      : t.stage === "closed"
                        ? " · cerrado"
                        : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Comisiones */}
      {commissions.length > 0 && (
        <section className="rounded-md border border-border bg-bg-secondary/20 p-5">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            <Coins className="w-3.5 h-3.5" /> Comisiones ({commissions.length})
          </div>
          <div className="space-y-1.5">
            {commissions.map((c) => {
              const amt = commissionAmount({
                dealValueUsd: c.deal_value_usd,
                commissionPct: c.commission_pct,
                commissionUsd: c.commission_usd,
              });
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-sm"
                >
                  <span className="text-muted-foreground text-[11px]">
                    {c.commission_pct != null ? `${c.commission_pct}%` : "monto fijo"}
                    {c.deal_value_usd != null ? ` sobre ${usd(c.deal_value_usd)}` : ""}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono">{usd(amt)}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {COMMISSION_STATUS_LABELS[(c.status as CommissionStatus) ?? "pendiente"] ??
                        c.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold font-mono mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
