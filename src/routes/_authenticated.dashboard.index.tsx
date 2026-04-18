import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { FolderKanban, Plus, Activity, Drill, TestTube2, Map as MapIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Resumen — Trackmin GeoIntel" }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { profile, user } = useAuth();
  const { projects, active } = useProjects();
  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "geólogo";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <header className="mb-8">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Bienvenido</div>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Hola, {name}.</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length === 0
            ? "Comienza creando tu primer proyecto de exploración."
            : `Tienes ${projects.length} proyecto${projects.length > 1 ? "s" : ""}. Activo: ${active?.name ?? "ninguno"}.`}
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
