import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useExecutiveKpis } from "@/hooks/useExecutiveKpis";
import {
  Plus, Activity, Drill, TestTube2, Map as MapIcon, ArrowRight,
  Ruler, Coins, TrendingUp, FlaskConical, Layers as LayersIcon, FolderKanban,
  ClipboardCheck, ShieldCheck, AlertTriangle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Resumen Ejecutivo — Trackmin GeoIntel" }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { profile, user } = useAuth();
  const { projects, active } = useProjects();
  const { kpis, loading } = useExecutiveKpis();
  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "geólogo";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <header className="mb-8">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Resumen ejecutivo</div>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Hola, {name}.</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length === 0
            ? "Comienza creando tu primer proyecto de exploración."
            : `${projects.length} proyecto${projects.length > 1 ? "s" : ""} activo${projects.length > 1 ? "s" : ""}. Activo: ${active?.name ?? "ninguno"}.`}
        </p>
      </header>

      {projects.length === 0 ? (
        <Link
          to="/dashboard/projects"
          className="block rounded border border-dashed border-gold/40 bg-gold/5 hover:bg-gold/10 transition-colors p-8 text-center"
        >
          <Plus className="w-8 h-8 text-gold mx-auto mb-3" />
          <div className="font-mono font-semibold text-foreground">Crear primer proyecto</div>
          <div className="text-xs text-muted-foreground mt-1">Define código, ubicación y commodity</div>
        </Link>
      ) : (
        <>
          {/* KPIs ejecutivos */}
          <section className="mb-6">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">KPIs operativos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={<FolderKanban className="w-4 h-4" />} label="Proyectos" value={loading ? "…" : String(kpis?.totalProjects ?? 0)} color="text-gold" />
              <Kpi icon={<Ruler className="w-4 h-4" />} label="m perforados" value={loading ? "…" : (kpis?.totalMetersDrilled ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} color="text-copper" />
              <Kpi icon={<FlaskConical className="w-4 h-4" />} label="Au promedio" value={loading ? "…" : kpis?.auWeightedAvg ? `${kpis.auWeightedAvg.toFixed(2)} g/t` : "—"} color="text-teal" />
              <Kpi icon={<Coins className="w-4 h-4" />} label="CapEx geofísico" value={loading ? "…" : `USD ${(kpis?.totalGeophysicsCapex ?? 0).toLocaleString()}`} color="text-info" />
              <Kpi icon={<Drill className="w-4 h-4" />} label="Total holes" value={loading ? "…" : String(kpis?.totalHoles ?? 0)} />
              <Kpi icon={<TestTube2 className="w-4 h-4" />} label="Muestras" value={loading ? "…" : String(kpis?.totalSamples ?? 0)} />
              <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Intercepts mes" value={loading ? "…" : String(kpis?.monthInterceptCount ?? 0)} color="text-gold" />
              <Kpi icon={<LayersIcon className="w-4 h-4" />} label="Capas marketplace" value="3+" />
            </div>
          </section>

          {/* Gobernanza Fase 1 */}
          <section className="mb-8">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal" /> Gobernanza & calidad
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/dashboard/approvals" className="block">
                <Kpi
                  icon={<ClipboardCheck className="w-4 h-4" />}
                  label="Pendientes revisión"
                  value={loading ? "…" : String(kpis?.pendingReview ?? 0)}
                  color={(kpis?.pendingReview ?? 0) > 0 ? "text-gold" : "text-muted-foreground"}
                />
              </Link>
              <Kpi
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Aprobados"
                value={loading ? "…" : String(kpis?.approvedRecords ?? 0)}
                color="text-teal"
              />
              <Kpi
                icon={<ClipboardCheck className="w-4 h-4" />}
                label="Borradores"
                value={loading ? "…" : String(kpis?.draftRecords ?? 0)}
              />
              <Link to="/dashboard/qaqc" className="block">
                <Kpi
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label={`QA/QC fail (${kpis?.qaqcTotal ?? 0})`}
                  value={loading ? "…" : kpis?.qaqcFailRate != null ? `${kpis.qaqcFailRate.toFixed(1)}%` : "—"}
                  color={(kpis?.qaqcFailRate ?? 0) > 10 ? "text-destructive" : (kpis?.qaqcFailRate ?? 0) > 0 ? "text-gold" : "text-teal"}
                />
              </Link>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Tus proyectos</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {projects.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to="/dashboard/projects"
                  className="block rounded border border-border bg-bg-secondary p-4 hover:border-gold/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono font-semibold">{p.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{p.code}</div>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">{p.role}</span>
                  </div>
                  {p.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="mt-3 text-[10px] font-mono text-muted-foreground">{p.commodity ?? "—"} · {p.region ?? p.country ?? ""}</div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Módulos del proyecto</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ModuleCard to="/dashboard/catastro" icon={<MapIcon className="w-5 h-5 text-gold" />} title="Catastro" />
              <ModuleCard to="/dashboard/geophysics" icon={<Activity className="w-5 h-5 text-info" />} title="Geofísica" />
              <ModuleCard to="/dashboard/drilling" icon={<Drill className="w-5 h-5 text-copper" />} title="Sondajes" />
              <ModuleCard to="/dashboard/sampling" icon={<TestTube2 className="w-5 h-5 text-teal" />} title="Muestreo" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, color = "text-foreground" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className={`inline-flex items-center gap-1 ${color}`}>{icon}</div>
      <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1.5">{label}</div>
      <div className={`text-lg font-mono font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function ModuleCard({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
  return (
    <Link
      to={to}
      className="rounded border border-border bg-bg-secondary p-4 hover:border-gold/40 transition-colors flex flex-col items-start gap-2"
    >
      {icon}
      <div className="font-mono font-semibold text-sm">{title}</div>
      <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
    </Link>
  );
}
