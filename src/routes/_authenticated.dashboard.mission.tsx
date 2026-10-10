import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { RoleSegmentedPanel } from "@/features/dashboard/RoleSegmentedPanel";
import { useProjects } from "@/hooks/useProjects";
import { useExecutiveKpis } from "@/hooks/useExecutiveKpis";
import { GeoScene3D } from "@/components/geoscene";
import { SceneErrorBoundary } from "@/components/geoscene/SceneErrorBoundary";
import {
  Plus,
  ArrowRight,
  Bell,
  Crosshair,
  Layers,
  Radio,
  Target as TargetIcon,
  Drill,
  TestTube2,
  Map as MapIcon,
  Satellite,
  Mountain,
  FileSignature,
  Handshake,
  Sparkles,
  Activity,
  ShieldCheck,
  Coins,
  Bot,
  FileWarning,
  AlertTriangle,
  CheckCircle2,
  Box,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/mission")({
  head: () => ({ meta: [{ title: "Mission Control del Proyecto — Geocapitals" }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { profile, user } = useAuth();
  const { projects, active } = useProjects();
  const { kpis, loading, refreshing, lastUpdated, refresh } = useExecutiveKpis();
  const { isComplete: onboardingComplete, refresh: refreshOnboarding } = useOnboardingStatus();
  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "operador";
  const needsOnboarding = !profile?.account_type || !onboardingComplete;

  if (projects.length === 0) {
    return (
      <div data-theme="im-light" className="min-h-full bg-background text-foreground">
        <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
          <header className="mb-6">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              Mission Control
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Hola, {name}.</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Explora · Modela · Certifica · Cierra deals. Todo en una sola plataforma.
            </p>
          </header>
          {needsOnboarding && (
            <div className="mb-6">
              <OnboardingWizard onComplete={refreshOnboarding} />
            </div>
          )}
          <Link
            to="/dashboard/projects"
            className="block rounded border border-dashed border-gold/40 bg-gold/5 hover:bg-gold/10 transition-colors p-8 text-center"
          >
            <Plus className="w-8 h-8 text-gold mx-auto mb-3" />
            <div className="font-mono font-semibold text-foreground">Crear primer proyecto</div>
            <div className="text-xs text-muted-foreground mt-1">
              Define código, ubicación y commodity
            </div>
          </Link>
        </div>
      </div>
    );
  }

  const k = kpis;
  const fmt = (n: number | null | undefined, d = 0) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d });

  // Fusion Score heurístico a partir de KPIs disponibles
  const fusion = computeFusionScore(k);

  // Acciones requeridas
  const tasks: Array<{
    to: string;
    icon: ReactNode;
    label: string;
    count: number;
    tone: "danger" | "warn";
  }> = [];
  if ((k?.alertsUnread ?? 0) > 0)
    tasks.push({
      to: "/catastro/proyecto",
      icon: <Bell className="w-3.5 h-3.5" />,
      label: "Alertas catastro",
      count: k!.alertsUnread,
      tone: "danger",
    });
  if ((k?.patentsDue ?? 0) > 0)
    tasks.push({
      to: "/catastro/proyecto",
      icon: <Coins className="w-3.5 h-3.5" />,
      label: "Patentes por pagar",
      count: k!.patentsDue,
      tone: "warn",
    });
  if ((k?.concessionsExpiring90d ?? 0) > 0)
    tasks.push({
      to: "/catastro/proyecto",
      icon: <FileWarning className="w-3.5 h-3.5" />,
      label: "Concesiones venciendo 90d",
      count: k!.concessionsExpiring90d,
      tone: "warn",
    });
  if ((k?.overlapsOpen ?? 0) > 0)
    tasks.push({
      to: "/catastro/proyecto",
      icon: <Layers className="w-3.5 h-3.5" />,
      label: "Overlaps sin resolver",
      count: k!.overlapsOpen,
      tone: "warn",
    });
  if ((k?.pendingReview ?? 0) > 0)
    tasks.push({
      to: "/dashboard/approvals",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      label: "Pendientes aprobación",
      count: k!.pendingReview,
      tone: "warn",
    });
  if ((k?.bulletinsUnread ?? 0) > 0)
    tasks.push({
      to: "/dashboard/boletin",
      icon: <Radio className="w-3.5 h-3.5" />,
      label: "Boletín minero",
      count: k!.bulletinsUnread,
      tone: "warn",
    });
  if ((k?.qaqcFailRate ?? 0) > 10)
    tasks.push({
      to: "/dashboard/qaqc",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: `QA/QC fail ${k!.qaqcFailRate!.toFixed(1)}%`,
      count: k!.qaqcTotal,
      tone: "danger",
    });

  const showOnboarding = needsOnboarding;

  return (
    <div data-theme="im-light" className="min-h-full bg-background text-foreground">
      <div className="p-3 md:p-6 max-w-[1600px] mx-auto pb-20 md:pb-6 space-y-5">
        {showOnboarding && <OnboardingWizard onComplete={refreshOnboarding} />}
        {!showOnboarding && profile?.account_type && !onboardingComplete && (
          <div className="rounded border border-gold/30 bg-gold/5 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-mono uppercase text-gold tracking-wider">Onboarding</span>
              <span className="ml-2 text-muted-foreground">
                Completa tu perfil para desbloquear todas las funciones.
              </span>
            </div>
            <Link to="/dashboard/profile" className="text-xs font-mono text-gold hover:underline">
              Continuar →
            </Link>
          </div>
        )}
        {/* Header con signos vitales del proyecto */}
        <header className="rounded border border-border bg-gradient-to-br from-bg-secondary to-bg-panel p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-gold" /> Mission Control · Geocapitals OS
              </div>
              <h1 className="text-xl md:text-2xl font-bold mt-1 truncate">
                {active?.name ?? "Sin proyecto activo"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {active?.code ?? "—"}
                {active?.commodity && <span> · {active.commodity}</span>}
                {active?.country && <span> · {active.country}</span>}
                <span className="text-hint"> · piloto {name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <VitalBadge
                label="Fusion Score"
                value={fusion.score == null ? "—" : `${fusion.score}`}
                tone={fusion.tone}
              />
              <VitalBadge
                label="QPS"
                value={
                  loading
                    ? "…"
                    : `${fmt(k?.approvedRecords)}/${fmt((k?.approvedRecords ?? 0) + (k?.pendingReview ?? 0))}`
                }
                tone={k?.pendingReview ? "warn" : "ok"}
              />
              <VitalBadge
                label="Activos"
                value={loading ? "…" : `${fmt(k?.activeTargets)} tgts`}
                tone="info"
              />
            </div>
          </div>

          {/* Acciones requeridas */}
          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Bell className="w-3 h-3 text-gold" /> Acciones requeridas{" "}
                <span className="text-gold">({tasks.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {tasks.map((t, i) => (
                  <Link
                    key={i}
                    to={t.to}
                    className={`group rounded border p-2 flex items-center gap-2 transition-colors ${
                      t.tone === "danger"
                        ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                        : "border-gold/30 bg-gold/5 hover:bg-gold/10"
                    }`}
                  >
                    <span className={t.tone === "danger" ? "text-destructive" : "text-gold"}>
                      {t.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono uppercase text-muted-foreground truncate">
                        {t.label}
                      </div>
                      <div
                        className={`text-sm font-mono font-bold ${t.tone === "danger" ? "text-destructive" : "text-gold"}`}
                      >
                        {t.count}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tasks.length === 0 && !loading && (
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal" />
              Sin acciones pendientes · operación al día
            </div>
          )}
        </header>

        {profile?.account_type && (
          <RoleSegmentedPanel
            accountType={profile.account_type as "investor" | "mining_owner" | "geocapitals_team"}
            kpis={k ?? null}
            loading={loading}
            refreshing={refreshing}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
          />
        )}

        {/* 4 PILARES — Explore · Model · Certify · Deal */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Pillar
            tone="cyan"
            icon={<Satellite className="w-5 h-5" />}
            number="01"
            title="Explore"
            subtitle="Descubrir el yacimiento"
            stats={[
              { label: "Targets activos", value: loading ? "…" : fmt(k?.activeTargets) },
              { label: "Campañas", value: loading ? "…" : fmt(k?.activeCampaigns) },
              {
                label: "Au prom",
                value: loading ? "…" : k?.auWeightedAvg ? `${k.auWeightedAvg.toFixed(2)} g/t` : "—",
              },
            ]}
            links={[
              {
                to: "/dashboard/targets",
                icon: <TargetIcon className="w-3.5 h-3.5" />,
                label: "Targets",
              },
              {
                to: "/dashboard/satellite-intel",
                icon: <Satellite className="w-3.5 h-3.5" />,
                label: "Satelital",
              },
              {
                to: "/dashboard/geophysics",
                icon: <Activity className="w-3.5 h-3.5" />,
                label: "Geofísica",
              },
              {
                to: "/catastro/proyecto",
                icon: <Crosshair className="w-3.5 h-3.5" />,
                label: "Catastro",
              },
            ]}
            primary={{ to: "/dashboard/targets", label: "Abrir Explore" }}
          />

          <Pillar
            tone="violet"
            icon={<Mountain className="w-5 h-5" />}
            number="02"
            title="Model"
            subtitle="3D real · superficie y subsuelo"
            stats={[
              { label: "Sondajes", value: loading ? "…" : fmt(k?.totalHoles) },
              { label: "m perforados", value: loading ? "…" : fmt(k?.totalMetersDrilled) },
              { label: "Muestras", value: loading ? "…" : fmt(k?.totalSamples) },
            ]}
            links={[
              {
                to: "/proyectos",
                icon: <Box className="w-3.5 h-3.5" />,
                label: "Visor 3D",
              },
              {
                to: "/dashboard/drilling",
                icon: <Drill className="w-3.5 h-3.5" />,
                label: "Sondajes",
              },
              {
                to: "/dashboard/sampling",
                icon: <TestTube2 className="w-3.5 h-3.5" />,
                label: "Muestreo",
              },
              {
                to: "/dashboard/estimation",
                icon: <Layers className="w-3.5 h-3.5" />,
                label: "Estimación",
              },
            ]}
            primary={{ to: "/proyectos", label: "Abrir visor 3D" }}
          />

          <Pillar
            tone="gold"
            icon={<FileSignature className="w-5 h-5" />}
            number="03"
            title="Certify"
            subtitle="NI 43-101 · QP · firma criptográfica"
            stats={[
              { label: "Aprobados", value: loading ? "…" : fmt(k?.approvedRecords) },
              { label: "En revisión", value: loading ? "…" : fmt(k?.pendingReview) },
              {
                label: "QA/QC",
                value: loading
                  ? "…"
                  : k?.qaqcFailRate != null
                    ? `${(100 - k.qaqcFailRate).toFixed(1)}%`
                    : "—",
              },
            ]}
            links={[
              {
                to: "/dashboard/ni43101",
                icon: <FileSignature className="w-3.5 h-3.5" />,
                label: "NI 43-101",
              },
              {
                to: "/reports/losverdes/pre43101",
                icon: <FileSignature className="w-3.5 h-3.5" />,
                label: "Pre-NI 43-101 LV5",
              },
              { to: "/dashboard/qps", icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "QPs" },
              {
                to: "/dashboard/qaqc",
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                label: "QA/QC",
              },
              {
                to: "/dashboard/approvals",
                icon: <ShieldCheck className="w-3.5 h-3.5" />,
                label: "Aprobaciones",
              },
            ]}
            primary={{ to: "/dashboard/ni43101", label: "Abrir certificación" }}
          />

          <Pillar
            tone="teal"
            icon={<Handshake className="w-5 h-5" />}
            number="04"
            title="Deal"
            subtitle="Inversionistas · marketplace · data room"
            stats={[
              { label: "Concesiones", value: loading ? "…" : fmt(k?.concessionsTotal) },
              { label: "Vigentes", value: loading ? "…" : fmt(k?.concessionsVigentes) },
              { label: "Fusion", value: fusion.score == null ? "—" : `${fusion.score}/100` },
            ]}
            links={[
              {
                to: "/dashboard/marketplace",
                icon: <TrendingUp className="w-3.5 h-3.5" />,
                label: "Marketplace",
              },
              {
                to: "/dashboard/deals",
                icon: <Handshake className="w-3.5 h-3.5" />,
                label: "Deals",
              },
              {
                to: "/dashboard/finance",
                icon: <Coins className="w-3.5 h-3.5" />,
                label: "Finanzas",
              },
              {
                to: "/dashboard/reports",
                icon: <FileSignature className="w-3.5 h-3.5" />,
                label: "Reportes",
              },
            ]}
            primary={{ to: "/dashboard/deals", label: "Abrir deal room" }}
          />
        </section>

        {/* Visor 3D canónico embebido — corazón visual de Mission Control */}
        <section className="rounded border border-border bg-bg-secondary overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-signal-violet" />
              <h2 className="text-[11px] font-mono uppercase tracking-wider text-foreground">
                GeoScene3D · visor canónico
              </h2>
            </div>
            <Link
              to="/proyectos"
              className="text-[10px] font-mono text-gold hover:underline"
            >
              Pantalla completa →
            </Link>
          </div>
          <div data-surface="canvas" className="h-[480px] relative">
            <SceneErrorBoundary label="GeoScene3D">
              <GeoScene3D />
            </SceneErrorBoundary>
          </div>
        </section>

        {/* Atajos rápidos */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Atajos
            </h2>
            <Link
              to="/dashboard/projects"
              className="text-[10px] font-mono text-gold hover:underline"
            >
              Cambiar proyecto →
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-8 lg:grid-cols-9 gap-2">
            <Shortcut
              to="/dashboard/map"
              icon={<MapIcon className="w-4 h-4 text-gold" />}
              title="Mapa táctico"
            />
            <Shortcut
              to="/proyectos"
              icon={<Box className="w-4 h-4 text-signal-violet" />}
              title="Visor 3D"
            />
            <Shortcut
              to="/catastro/proyecto"
              icon={<Crosshair className="w-4 h-4 text-teal" />}
              title="Catastro"
            />
            <Shortcut
              to="/dashboard/opportunities"
              icon={<Sparkles className="w-4 h-4 text-yellow-500" />}
              title="Oportunidades IA"
            />
            <Shortcut
              to="/dashboard/estimation"
              icon={<Layers className="w-4 h-4 text-copper" />}
              title="Estimación"
            />
            <Shortcut
              to="/dashboard/precios"
              icon={<Coins className="w-4 h-4 text-emerald-500" />}
              title="Precios metales"
            />
            <Shortcut
              to="/dashboard/agents"
              icon={<Bot className="w-4 h-4 text-gold" />}
              title="Panel de agentes"
            />
            <Shortcut
              to="/dashboard/hse"
              icon={<ShieldCheck className="w-4 h-4 text-info" />}
              title="HSE"
            />
            <Shortcut
              to="/dashboard/team"
              icon={<Sparkles className="w-4 h-4 text-gold" />}
              title="Equipo"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function computeFusionScore(k: ReturnType<typeof useExecutiveKpis>["kpis"]) {
  if (!k) return { score: null as number | null, tone: "muted" as const };
  let s = 0;
  let n = 0;
  if (k.activeTargets != null) {
    s += Math.min(25, k.activeTargets * 2);
    n += 25;
  }
  if (k.totalHoles != null) {
    s += Math.min(25, k.totalHoles * 1.5);
    n += 25;
  }
  if (k.auWeightedAvg != null) {
    s += Math.min(25, k.auWeightedAvg * 25);
    n += 25;
  }
  if (k.approvedRecords != null) {
    s += Math.min(25, k.approvedRecords * 0.5);
    n += 25;
  }
  if (n === 0) return { score: null, tone: "muted" as const };
  const score = Math.round((s / n) * 100);
  const tone =
    score >= 70 ? ("ok" as const) : score >= 40 ? ("warn" as const) : ("danger" as const);
  return { score, tone };
}

function VitalBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "info" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-teal border-teal/40 bg-teal/5"
      : tone === "warn"
        ? "text-gold border-gold/40 bg-gold/5"
        : tone === "danger"
          ? "text-destructive border-destructive/40 bg-destructive/5"
          : tone === "info"
            ? "text-info border-info/40 bg-info/5"
            : "text-muted-foreground border-border bg-bg-secondary";
  return (
    <div className={`rounded border px-2.5 py-1.5 ${color}`}>
      <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-mono font-bold leading-tight">{value}</div>
    </div>
  );
}

const TONE_STYLES = {
  cyan: {
    ring: "border-signal-cyan/30 hover:border-signal-cyan/60",
    ico: "text-signal-cyan bg-signal-cyan/10",
    num: "text-signal-cyan",
  },
  violet: {
    ring: "border-signal-violet/30 hover:border-signal-violet/60",
    ico: "text-signal-violet bg-signal-violet/10",
    num: "text-signal-violet",
  },
  gold: {
    ring: "border-gold/30 hover:border-gold/60",
    ico: "text-gold bg-gold/10",
    num: "text-gold",
  },
  teal: {
    ring: "border-teal/30 hover:border-teal/60",
    ico: "text-teal bg-teal/10",
    num: "text-teal",
  },
} as const;

function Pillar({
  tone,
  icon,
  number,
  title,
  subtitle,
  stats,
  links,
  primary,
}: {
  tone: keyof typeof TONE_STYLES;
  icon: ReactNode;
  number: string;
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  links: { to: string; icon: ReactNode; label: string }[];
  primary: { to: string; label: string };
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className={`rounded border bg-bg-secondary p-4 transition-colors ${s.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded p-2 ${s.ico}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-[10px] font-mono ${s.num}`}>{number}</span>
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Link
          to={primary.to}
          className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${s.ring}`}
        >
          Abrir <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {stats.map((st) => (
          <div key={st.label} className="rounded border border-border bg-bg-panel p-2">
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              {st.label}
            </div>
            <div className="text-sm font-mono font-bold mt-0.5 truncate">{st.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border border-border bg-bg-panel hover:border-gold/40 hover:bg-gold/5 transition-colors"
          >
            <span className={s.num}>{l.icon}</span>
            <span className="truncate font-mono">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Shortcut({ to, icon, title }: { to: string; icon: ReactNode; title: string }) {
  return (
    <Link
      to={to}
      className="rounded border border-border bg-bg-secondary p-2.5 hover:border-gold/40 transition-colors flex items-center gap-2"
    >
      {icon}
      <div className="font-mono font-semibold text-xs truncate">{title}</div>
    </Link>
  );
}
