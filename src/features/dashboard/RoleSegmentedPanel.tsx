// Cards y KPIs específicos por tipo de cuenta. Se renderiza entre el header
// vital y los 4 pilares en el Mission Control. Cada variante usa datos
// reales del hook useExecutiveKpis sin pedir nuevas queries.
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  Mountain,
  Gem,
  ArrowRight,
  TrendingUp,
  Handshake,
  FileSignature,
  Sparkles,
  Coins,
  Bot,
  FileWarning,
  Bell,
  Layers,
  Radio,
  Target as TargetIcon,
  Drill,
  TestTube2,
  ShieldCheck,
  Satellite,
  Box,
  Activity,
  RefreshCw,
  Wallet,
  Ship,
} from "lucide-react";
import type { ExecutiveKpis } from "@/hooks/useExecutiveKpis";

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 5) return "ahora";
  if (diff < 60) return `hace ${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return date.toLocaleString();
}

type AccountType = "investor" | "mining_owner" | "geocapitals_team";

const TONE = {
  gold: "text-gold border-gold/30 bg-gold/5",
  teal: "text-teal border-teal/30 bg-teal/5",
  cyan: "text-signal-cyan border-signal-cyan/30 bg-signal-cyan/5",
  violet: "text-signal-violet border-signal-violet/30 bg-signal-violet/5",
  danger: "text-destructive border-destructive/40 bg-destructive/5",
  info: "text-info border-info/30 bg-info/5",
} as const;

type Tone = keyof typeof TONE;

function Kpi({
  label,
  value,
  hint,
  tone = "gold",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={`rounded border p-3 ${TONE[tone]}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider opacity-80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-mono font-bold mt-1 leading-none">{value}</div>
      {hint ? <div className="text-[10px] font-mono opacity-70 mt-1">{hint}</div> : null}
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
  desc,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-2.5 rounded border border-border bg-bg-panel p-2.5 hover:border-gold/50 hover:bg-gold/5 transition-colors"
    >
      <span className="text-gold mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-semibold text-foreground truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground leading-snug">{desc}</div>
      </div>
      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-gold mt-1" />
    </Link>
  );
}

const fmt = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d });

export function RoleSegmentedPanel({
  accountType,
  kpis,
  loading,
  refreshing = false,
  lastUpdated = null,
  onRefresh,
}: {
  accountType: AccountType;
  kpis: ExecutiveKpis | null;
  loading: boolean;
  refreshing?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void | Promise<void>;
}) {
  const meta = META[accountType];
  const Icon = meta.icon;

  // Re-render cada 30s para mantener vivo el "hace Xm".
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastUpdated) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [lastUpdated]);

  return (
    <section className="rounded border border-border bg-bg-secondary p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-start gap-3">
          <div className={`rounded p-2 ${TONE[meta.tone]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-gold" /> Tu vista · {meta.title}
            </div>
            <h2 className="text-base md:text-lg font-bold mt-0.5">{meta.headline}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing || loading}
              title={`Datos actualizados ${formatRelative(lastUpdated)}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase px-2.5 py-1.5 rounded border border-border bg-bg-panel hover:border-gold/50 hover:text-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{formatRelative(lastUpdated)}</span>
            </button>
          )}
          <Link
            to={meta.primary.to}
            className={`text-[11px] font-mono uppercase px-3 py-1.5 rounded border ${TONE[meta.tone]} hover:opacity-90`}
          >
            {meta.primary.label} <ArrowRight className="w-3 h-3 inline ml-1" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {renderKpis(accountType, kpis, loading)}
      </div>

      <div className="mt-4 pt-4 border-t border-border/60">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Accesos clave
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {meta.quick.map((q) => (
            <QuickLink key={q.to} {...q} />
          ))}
        </div>
      </div>
    </section>
  );
}

const META: Record<
  AccountType,
  {
    icon: typeof Briefcase;
    tone: Tone;
    title: string;
    headline: string;
    subtitle: string;
    primary: { to: string; label: string };
    quick: { to: string; icon: ReactNode; label: string; desc: string }[];
  }
> = {
  investor: {
    icon: Briefcase,
    tone: "teal",
    title: "Inversionista",
    headline: "Deal flow y oportunidades verificadas",
    subtitle: "Marketplace, data rooms, NI 43-101 firmados y watchlist catastral.",
    primary: { to: "/dashboard/deals", label: "Abrir deal flow" },
    quick: [
      {
        to: "/marketplace",
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        label: "Marketplace",
        desc: "Listados activos por commodity y región.",
      },
      {
        to: "/dashboard/deals",
        icon: <Handshake className="w-3.5 h-3.5" />,
        label: "Pipeline de deals",
        desc: "Inquiries, NDAs y term sheets en curso.",
      },
      {
        to: "/dashboard/opportunities",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        label: "Oportunidades IA",
        desc: "Tesis automáticas sobre catastro + satelital.",
      },
      {
        to: "/dashboard/investments",
        icon: <Wallet className="w-3.5 h-3.5" />,
        label: "Mis inversiones",
        desc: "Historial, estados de pago y montos.",
      },
      {
        to: "/dashboard/offerings",
        icon: <Coins className="w-3.5 h-3.5" />,
        label: "Tokenización",
        desc: "Ofertas fraccionadas y cap table.",
      },
      {
        to: "/dashboard/reports",
        icon: <FileSignature className="w-3.5 h-3.5" />,
        label: "Reportes firmados",
        desc: "NI 43-101 y memos QP verificables.",
      },
    ],
  },
  mining_owner: {
    icon: Mountain,
    tone: "gold",
    title: "Titular / Holder",
    headline: "Tu portafolio de concesiones, en tiempo real",
    subtitle: "Vigencia, patentes, overlaps y boletín minero monitoreados.",
    primary: { to: "/catastro/mapa", label: "Abrir catastro" },
    quick: [
      {
        to: "/catastro/mapa",
        icon: <Layers className="w-3.5 h-3.5" />,
        label: "Mis concesiones",
        desc: "Vigencia, geometría y trazabilidad.",
      },
      {
        to: "/catastro/mapa",
        icon: <Coins className="w-3.5 h-3.5" />,
        label: "Patentes",
        desc: "Calendario de pago y vencimientos.",
      },
      {
        to: "/dashboard/boletin",
        icon: <Radio className="w-3.5 h-3.5" />,
        label: "Boletín minero",
        desc: "Alertas oficiales sobre tus AOIs.",
      },
      {
        to: "/dashboard/precios",
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        label: "Precios metales",
        desc: "Cobre BML en vivo y poder de compra ENAMI.",
      },
      {
        to: "/dashboard/agents",
        icon: <Bot className="w-3.5 h-3.5" />,
        label: "Panel de agentes",
        desc: "Confianza, valor y demanda de tus lotes.",
      },
      {
        to: "/dashboard/listings",
        icon: <Handshake className="w-3.5 h-3.5" />,
        label: "Publicar deal",
        desc: "Sale, JV o royalty con data room.",
      },
      {
        to: "/dashboard/trades",
        icon: <Ship className="w-3.5 h-3.5" />,
        label: "Trade Desk",
        desc: "Exportación: ICPO, SPA, SBLC y documentos.",
      },
    ],
  },
  geocapitals_team: {
    icon: Gem,
    tone: "violet",
    title: "Equipo técnico",
    headline: "Workspace de proyecto end-to-end",
    subtitle: "Targets, sondajes, QA/QC, satelital, 3D y certificación NI 43-101.",
    primary: { to: "/dashboard/geology3d", label: "Abrir visor 3D" },
    quick: [
      {
        to: "/dashboard/targets",
        icon: <TargetIcon className="w-3.5 h-3.5" />,
        label: "Targets",
        desc: "Priorización con fusion score.",
      },
      {
        to: "/dashboard/drilling",
        icon: <Drill className="w-3.5 h-3.5" />,
        label: "Sondajes",
        desc: "Collars, surveys y trayectorias.",
      },
      {
        to: "/dashboard/sampling",
        icon: <TestTube2 className="w-3.5 h-3.5" />,
        label: "Muestreo y QA/QC",
        desc: "Resultados con control estadístico.",
      },
      {
        to: "/dashboard/ni43101",
        icon: <FileSignature className="w-3.5 h-3.5" />,
        label: "NI 43-101",
        desc: "Secciones, evidencia y firma QP.",
      },
    ],
  },
};

function renderKpis(accountType: AccountType, k: ExecutiveKpis | null, loading: boolean) {
  const v = (n: number | null | undefined, d = 0) => (loading ? "…" : fmt(n, d));

  if (accountType === "investor") {
    return (
      <>
        <Kpi
          label="Deals activos"
          value={v(k?.activeCampaigns)}
          hint="campañas y deals en curso"
          tone="teal"
          icon={<Handshake className="w-3 h-3" />}
        />
        <Kpi
          label="Reportes aprobados"
          value={v(k?.approvedRecords)}
          hint={`${v(k?.pendingReview)} en revisión`}
          tone="gold"
          icon={<FileSignature className="w-3 h-3" />}
        />
        <Kpi
          label="Targets activos"
          value={v(k?.activeTargets)}
          hint="oportunidades técnicas vivas"
          tone="cyan"
          icon={<TargetIcon className="w-3 h-3" />}
        />
        <Kpi
          label="Au prom ponderado"
          value={loading ? "…" : k?.auWeightedAvg ? `${k.auWeightedAvg.toFixed(2)} g/t` : "—"}
          hint="intercepciones ponderadas"
          tone="violet"
          icon={<Activity className="w-3 h-3" />}
        />
      </>
    );
  }

  if (accountType === "mining_owner") {
    return (
      <>
        <Kpi
          label="Concesiones"
          value={v(k?.concessionsTotal)}
          hint={`${v(k?.concessionsVigentes)} vigentes`}
          tone="gold"
          icon={<Layers className="w-3 h-3" />}
        />
        <Kpi
          label="Vencen 90d"
          value={v(k?.concessionsExpiring90d)}
          hint="acción requerida"
          tone={k?.concessionsExpiring90d ? "danger" : "teal"}
          icon={<FileWarning className="w-3 h-3" />}
        />
        <Kpi
          label="Patentes por pagar"
          value={v(k?.patentsDue)}
          hint="calendario fiscal"
          tone={k?.patentsDue ? "danger" : "teal"}
          icon={<Coins className="w-3 h-3" />}
        />
        <Kpi
          label="Alertas catastro"
          value={v(k?.alertsUnread)}
          hint={`${v(k?.bulletinsUnread)} en boletín`}
          tone={k?.alertsUnread ? "danger" : "teal"}
          icon={<Bell className="w-3 h-3" />}
        />
      </>
    );
  }

  // geocapitals_team
  return (
    <>
      <Kpi
        label="Sondajes"
        value={v(k?.totalHoles)}
        hint={`${v(k?.totalMetersDrilled)} m perforados`}
        tone="violet"
        icon={<Drill className="w-3 h-3" />}
      />
      <Kpi
        label="Muestras"
        value={v(k?.totalSamples)}
        hint="con QA/QC"
        tone="cyan"
        icon={<TestTube2 className="w-3 h-3" />}
      />
      <Kpi
        label="QA/QC OK"
        value={
          loading ? "…" : k?.qaqcFailRate != null ? `${(100 - k.qaqcFailRate).toFixed(1)}%` : "—"
        }
        hint={`${v(k?.qaqcTotal)} controles`}
        tone={(k?.qaqcFailRate ?? 0) > 10 ? "danger" : "teal"}
        icon={<ShieldCheck className="w-3 h-3" />}
      />
      <Kpi
        label="Pendientes QP"
        value={v(k?.pendingReview)}
        hint={`${v(k?.approvedRecords)} aprobados`}
        tone={k?.pendingReview ? "gold" : "teal"}
        icon={<Satellite className="w-3 h-3" />}
      />
    </>
  );
}

// re-export helper icon used above to avoid unused-import lint when tree-shaking
export const __unused = Box;
