import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Calculator,
  Eye,
  MessageSquare,
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getSellerAgentsOverview, type LotAgentsRow } from "@/lib/agentsOverview.functions";
import { commodityLabel } from "@/lib/commodityLabels";
import { QueryError } from "@/components/ui/QueryError";

export const Route = createFileRoute("/_authenticated/dashboard/agents")({
  head: () => ({ meta: [{ title: "Panel de agentes — Geocapitals" }] }),
  component: AgentsPanel,
});

const HEALTH = {
  healthy: { label: "Sano", cls: "text-teal border-teal/40 bg-teal/10", icon: CheckCircle2 },
  attention: { label: "Atención", cls: "text-gold border-gold/40 bg-gold/10", icon: AlertTriangle },
  risk: { label: "Riesgo", cls: "text-danger border-danger/40 bg-danger/10", icon: XCircle },
} as const;

const TRUST_CLS: Record<string, string> = {
  high: "text-teal",
  medium: "text-gold",
  low: "text-danger",
};

const MARKET_LABEL: Record<string, string> = {
  en_mercado: "En mercado",
  sobre_mercado: "Sobre mercado",
  bajo_mercado: "Bajo mercado",
  sin_datos: "Sin precio",
};

function AgentsPanel() {
  const fn = useServerFn(getSellerAgentsOverview);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["seller-agents-overview"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3 h-3" /> Dashboard
      </Link>
      <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
        <Bot className="w-5 h-5 text-gold" /> Panel de agentes
      </h1>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        Cómo se ven tus lotes a través de los agentes: verificación Know-Your-Mine, valor pagable y
        demanda. Actúa sobre los que están en riesgo o atención.
      </p>

      {isError ? (
        <QueryError message="No pudimos cargar tus lotes." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded border border-border bg-bg-panel p-4 animate-pulse h-24"
            />
          ))}
        </div>
      ) : !data || data.lots.length === 0 ? (
        <div className="rounded border border-border bg-bg-panel p-8 text-center text-sm text-muted-foreground">
          No tienes lotes de commodities todavía.{" "}
          <Link to="/dashboard/commodity-lots" className="text-gold hover:underline">
            Publicar un lote
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <SummaryCard label="Sanos" value={data.summary.healthy} tone="text-teal" />
            <SummaryCard label="Atención" value={data.summary.attention} tone="text-gold" />
            <SummaryCard label="En riesgo" value={data.summary.risk} tone="text-danger" />
          </div>
          <div className="space-y-2">
            {data.lots.map((l) => (
              <AgentLotCard key={l.lotId} lot={l} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded border border-border bg-bg-panel p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function AgentLotCard({ lot: l }: { lot: LotAgentsRow }) {
  const health = HEALTH[l.health];
  const HealthIcon = health.icon;
  return (
    <div className="rounded border border-border bg-bg-panel p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <Link
            to="/marketplace/$lotId"
            params={{ lotId: l.lotId }}
            className="text-sm font-semibold text-foreground hover:text-gold truncate"
          >
            {l.title}
          </Link>
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {commodityLabel(l.commodity)} · {l.status}
            {l.isVerified && " · verificado"}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${health.cls}`}
        >
          <HealthIcon className="w-3 h-3" /> {health.label}
        </span>
      </div>

      <div className="mt-2 text-[11px] text-foreground/80">{l.headline}</div>

      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
        <Metric
          icon={l.trust.redFlags > 0 ? ShieldAlert : ShieldCheck}
          label="Confianza"
          value={`${l.trust.score}/100`}
          cls={TRUST_CLS[l.trust.level]}
        />
        <Metric
          icon={Calculator}
          label="Valor neto/t"
          value={l.valuation.netUsdDmt != null ? `US$ ${Math.round(l.valuation.netUsdDmt)}` : "—"}
        />
        <Metric icon={Eye} label="Vistas" value={String(l.views)} />
        <Metric icon={MessageSquare} label="Consultas" value={String(l.inquiries)} />
      </div>

      <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
        Precio: {MARKET_LABEL[l.market.verdict]}
        {l.market.deltaPct != null &&
          ` · ${l.market.deltaPct > 0 ? "+" : ""}${(l.market.deltaPct * 100).toFixed(0)}% vs. estimado`}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  cls,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  cls?: string;
}) {
  return (
    <div className="rounded border border-border/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`font-bold mt-0.5 ${cls ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
