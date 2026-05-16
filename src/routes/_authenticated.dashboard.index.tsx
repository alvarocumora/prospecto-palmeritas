import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useExecutiveKpis } from "@/hooks/useExecutiveKpis";
import {
  Plus,
  Activity,
  Drill,
  TestTube2,
  Map as MapIcon,
  ArrowRight,
  Coins,
  FileWarning,
  FolderKanban,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Layers,
  Bell,
  Radio,
  Target as TargetIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Mission Control — Geocapitals" }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { profile, user } = useAuth();
  const { projects, active } = useProjects();
  const { kpis, loading } = useExecutiveKpis();
  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "operador";

  if (projects.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
        <header className="mb-6">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Mission Control
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Hola, {name}.</h1>
        </header>
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
    );
  }

  const k = kpis;
  const fmt = (n: number | null | undefined, d = 0) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d });

  // Tareas operativas reales
  const tasks: Array<{
    to: string;
    icon: React.ReactNode;
    label: string;
    count: number;
    tone: "danger" | "warn" | "ok";
  }> = [];
  if ((k?.alertsUnread ?? 0) > 0)
    tasks.push({
      to: "/dashboard/catastro",
      icon: <Bell className="w-3.5 h-3.5" />,
      label: "Alertas catastro",
      count: k!.alertsUnread,
      tone: "danger",
    });
  if ((k?.patentsDue ?? 0) > 0)
    tasks.push({
      to: "/dashboard/catastro",
      icon: <Coins className="w-3.5 h-3.5" />,
      label: "Patentes por pagar",
      count: k!.patentsDue,
      tone: "warn",
    });
  if ((k?.concessionsExpiring90d ?? 0) > 0)
    tasks.push({
      to: "/dashboard/catastro",
      icon: <FileWarning className="w-3.5 h-3.5" />,
      label: "Concesiones venciendo 90d",
      count: k!.concessionsExpiring90d,
      tone: "warn",
    });
  if ((k?.overlapsOpen ?? 0) > 0)
    tasks.push({
      to: "/dashboard/catastro",
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

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto pb-20 md:pb-6 space-y-5">
      {/* Header compacto */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Mission Control
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-0.5">Hola, {name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Proyecto activo:{" "}
            <span className="font-mono text-foreground">{active?.name ?? "—"}</span>
            {active?.code && <span className="text-muted-foreground"> · {active.code}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/map"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase rounded border border-border hover:border-gold/40 hover:bg-gold/5"
          >
            <MapIcon className="w-3.5 h-3.5" /> Mapa táctico
          </Link>
          <Link
            to="/dashboard/catastro"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase rounded bg-primary text-primary-foreground hover:opacity-90"
          >
            <Crosshair className="w-3.5 h-3.5" /> Catastro
          </Link>
        </div>
      </header>

      {/* Tareas / acciones requeridas */}
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Bell className="w-3 h-3" /> Acciones requeridas{" "}
          {tasks.length > 0 && <span className="text-gold">({tasks.length})</span>}
        </h2>
        {tasks.length === 0 ? (
          <div className="rounded border border-border bg-bg-secondary p-3 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal" />
            Sin acciones pendientes. Operación al día.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tasks.map((t, i) => (
              <Link
                key={i}
                to={t.to}
                className={`group rounded border p-2.5 flex items-center gap-2 transition-colors ${
                  t.tone === "danger"
                    ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                    : "border-gold/30 bg-gold/5 hover:bg-gold/10"
                }`}
              >
                <span className={t.tone === "danger" ? "text-destructive" : "text-gold"}>
                  {t.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground truncate">
                    {t.label}
                  </div>
                  <div
                    className={`text-base font-mono font-bold ${t.tone === "danger" ? "text-destructive" : "text-gold"}`}
                  >
                    {t.count}
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Catastro — estado real */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Crosshair className="w-3 h-3" /> Catastro
          </h2>
          <Link
            to="/dashboard/catastro"
            className="text-[10px] font-mono text-gold hover:underline"
          >
            Abrir →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label="Total" value={loading ? "…" : fmt(k?.concessionsTotal)} />
          <Stat label="Vigentes" value={loading ? "…" : fmt(k?.concessionsVigentes)} tone="ok" />
          <Stat
            label="En constitución"
            value={loading ? "…" : fmt(k?.concessionsConstitucion)}
            tone="warn"
          />
          <Stat
            label="Caducadas"
            value={loading ? "…" : fmt(k?.concessionsCaducadas)}
            tone="danger"
          />
          <Stat
            label="Vencen 90d"
            value={loading ? "…" : fmt(k?.concessionsExpiring90d)}
            tone={k?.concessionsExpiring90d ? "danger" : "muted"}
          />
        </div>
      </section>

      {/* Operación */}
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> Operación
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Stat label="Campañas activas" value={loading ? "…" : fmt(k?.activeCampaigns)} />
          <Stat label="Targets activos" value={loading ? "…" : fmt(k?.activeTargets)} tone="ok" />
          <Stat label="Sondajes" value={loading ? "…" : fmt(k?.totalHoles)} />
          <Stat label="m perforados" value={loading ? "…" : fmt(k?.totalMetersDrilled)} />
          <Stat label="Muestras" value={loading ? "…" : fmt(k?.totalSamples)} />
          <Stat
            label="Au promedio"
            value={loading ? "…" : k?.auWeightedAvg ? `${k.auWeightedAvg.toFixed(2)} g/t` : "—"}
            tone="ok"
          />
        </div>
      </section>

      {/* Gobernanza */}
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Gobernanza
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Aprobados" value={loading ? "…" : fmt(k?.approvedRecords)} tone="ok" />
          <Stat
            label="En revisión"
            value={loading ? "…" : fmt(k?.pendingReview)}
            tone={k?.pendingReview ? "warn" : "muted"}
          />
          <Stat label="Borradores" value={loading ? "…" : fmt(k?.draftRecords)} />
          <Stat
            label="QA/QC fail"
            value={loading ? "…" : k?.qaqcFailRate != null ? `${k.qaqcFailRate.toFixed(1)}%` : "—"}
            tone={(k?.qaqcFailRate ?? 0) > 10 ? "danger" : "ok"}
          />
        </div>
      </section>

      {/* Acceso a módulos */}
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Módulos
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Mod to="/dashboard/map" icon={<MapIcon className="w-4 h-4 text-gold" />} title="Mapa" />
          <Mod
            to="/dashboard/catastro"
            icon={<Crosshair className="w-4 h-4 text-gold" />}
            title="Catastro"
          />
          <Mod
            to="/dashboard/targets"
            icon={<TargetIcon className="w-4 h-4 text-teal" />}
            title="Targets"
          />
          <Mod
            to="/dashboard/drilling"
            icon={<Drill className="w-4 h-4 text-copper" />}
            title="Sondajes"
          />
          <Mod
            to="/dashboard/sampling"
            icon={<TestTube2 className="w-4 h-4 text-teal" />}
            title="Muestreo"
          />
          <Mod
            to="/dashboard/projects"
            icon={<FolderKanban className="w-4 h-4 text-info" />}
            title="Proyectos"
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "danger" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-teal"
      : tone === "warn"
        ? "text-gold"
        : tone === "danger"
          ? "text-destructive"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div className="rounded border border-border bg-bg-secondary p-2.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div className={`text-base md:text-lg font-mono font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Mod({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
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
