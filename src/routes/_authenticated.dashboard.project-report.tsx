import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectWorkspaceViewer } from "@/components/geo/ProjectWorkspaceViewer";
import { getPublicProjectById } from "@/lib/projects/catalog";
import { terminalSlugForListing } from "@/features/terminal/terminalProjects";
import { projectView, type ProjectView } from "@/lib/projects/navigation";

type ProjectPanel = "mapa" | "satelite" | "spv";

const CholquiSatellitePanel = lazy(() =>
  import("@/features/franco/components/CholquiSatellitePanel").then((module) => ({
    default: module.CholquiSatellitePanel,
  })),
);
const CholquiSpvPanel = lazy(() =>
  import("@/features/franco/components/CholquiSpvPanel").then((module) => ({
    default: module.CholquiSpvPanel,
  })),
);

export const Route = createFileRoute("/_authenticated/dashboard/project-report")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    view?: ProjectView;
    panel?: ProjectPanel;
  } => ({
    view: search.view == null ? undefined : projectView(search.view),
    panel: search.panel === "satelite" || search.panel === "spv" ? search.panel : undefined,
  }),
  head: () => ({ meta: [{ title: "Workspace de proyecto — Geocapitals" }] }),
  component: ProjectReportPage,
});

function ProjectReportPage() {
  const { active, loading } = useProjects();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = projectView(search.view);
  const panel = search.panel ?? "mapa";
  const publishedProject = active ? getPublicProjectById(active.id) : null;
  const isCholqui = publishedProject?.slug === "cholqui";
  const publicSlug = active
    ? (publishedProject?.slug ?? terminalSlugForListing({ code: active.code }))
    : null;

  useEffect(() => {
    if (active && !search.project) {
      void navigate({ search: { ...search, project: active.id }, replace: true });
    }
  }, [active, navigate, search]);

  if (loading) return <div className="p-6 text-sm">Cargando proyecto…</div>;
  if (!active) {
    return (
      <div className="p-6">
        <p>Selecciona un proyecto para abrir su workspace.</p>
        <Link to="/dashboard/projects" className="text-primary underline">
          Ir a proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-project-workspace={active.id}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{active.name}</h1>
          <p className="text-xs text-muted-foreground">{active.code} · Workspace privado</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link to="/dashboard/projects" className="text-primary">
            Proyectos
          </Link>
          <Link
            to="/dashboard/projects/$projectId"
            params={{ projectId: active.id }}
            className="text-primary"
          >
            Ficha y financiamiento
          </Link>
          {publicSlug && (
            <Link
              to="/terminal/$slug"
              params={{ slug: publicSlug }}
              search={{ tab: "mapa", view }}
              target="_blank"
              rel="noreferrer"
              className="text-primary"
            >
              Abrir ficha pública ↗
            </Link>
          )}
        </div>
      </header>
      {isCholqui && (
        <nav className="flex gap-2 text-xs">
          {(["mapa", "satelite", "spv"] as const).map((key) => (
            <Link
              key={key}
              to="/dashboard/project-report"
              search={{ project: active.id, view, panel: key === "mapa" ? undefined : key }}
              aria-current={panel === key ? "page" : undefined}
              className="rounded border border-border px-3 py-2"
            >
              {key === "mapa"
                ? "Mapa & exploración"
                : key === "satelite"
                  ? "Satélite"
                  : "Inversionistas & SPV"}
            </Link>
          ))}
        </nav>
      )}
      {!isCholqui || panel === "mapa" ? (
        <ProjectWorkspaceViewer
          key={active.id}
          projectId={active.id}
          mode={view}
          onModeChange={(nextView) => {
            void navigate({
              search: { ...search, project: active.id, view: nextView },
              replace: true,
            });
          }}
        />
      ) : (
        <Suspense fallback={<p className="text-sm">Cargando módulo…</p>}>
          {panel === "satelite" ? (
            <CholquiSatellitePanel />
          ) : (
            <CholquiSpvPanel projectCode={active.code} projectName={active.name} />
          )}
        </Suspense>
      )}
    </div>
  );
}
