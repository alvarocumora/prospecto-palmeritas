import { Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { ProjectWorkspaceViewer } from "@/components/geo/ProjectWorkspaceViewer";
import { getPublicProjectById } from "@/lib/projects/catalog";
import { terminalSlugForListing } from "@/features/terminal/terminalProjects";
import type { ProjectView } from "@/lib/projects/navigation";
import {
  PROJECT_WORKSPACE_SECTIONS,
  projectWorkspacePath,
  type ProjectWorkspaceSearch,
  type ProjectWorkspaceSection,
} from "@/lib/projects/workspace";

const ProjectExploration = lazy(() =>
  import("./ProjectExploration").then((module) => ({ default: module.GeophysicsModule })),
);
const ProjectTargets = lazy(() =>
  import("./ProjectTargets").then((module) => ({ default: module.TargetsPage })),
);
const ProjectValidation = lazy(() =>
  import("./ProjectValidation").then((module) => ({ default: module.QaQcPage })),
);
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

export function ProjectWorkspacePage({
  projectId,
  section,
  search,
  onViewChange,
}: {
  projectId: string;
  section: ProjectWorkspaceSection;
  search: ProjectWorkspaceSearch;
  onViewChange: (view: ProjectView) => void;
}) {
  const { projects, active, loading } = useProjects();
  const access = useWorkspaceAccess();
  const project = projects.find((item) => item.id === projectId);
  const view = section === "model" ? "3d" : "2d";
  const panel = section === "overview" ? (search.panel ?? "mapa") : "mapa";
  const publishedProject = getPublicProjectById(projectId);
  const isCholqui = publishedProject?.slug === "cholqui";
  const publicSlug = project
    ? (publishedProject?.slug ?? terminalSlugForListing({ code: project.code }))
    : null;

  if (loading || (project && (active?.id !== projectId || !access.ready))) {
    return <div className="p-6 text-sm">Activando proyecto…</div>;
  }
  if (!project) {
    return <div className="p-6 text-sm">Este proyecto no está disponible en tu workspace.</div>;
  }
  if (!access.canPath(projectWorkspacePath(projectId, section)).allowed) {
    return <div className="p-6 text-sm">No tienes acceso a esta sección del proyecto.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-project-workspace={projectId}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-xs text-muted-foreground">{project.code} · Workspace privado</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link to="/dashboard/projects" search={{ project: undefined }} className="text-primary">
            Proyectos
          </Link>
          <Link
            to="/dashboard/projects/$projectId"
            params={{ projectId }}
            search={{ project: undefined }}
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
      <nav aria-label="Secciones del proyecto" className="flex gap-2 overflow-x-auto text-xs">
        {PROJECT_WORKSPACE_SECTIONS.filter(
          (item) => access.canPath(projectWorkspacePath(projectId, item.id)).allowed,
        ).map((item) => (
          <Link
            key={item.id}
            to="/projects/$projectId/$section"
            params={{ projectId, section: item.id }}
            search={{ project: undefined }}
            aria-current={section === item.id ? "page" : undefined}
            className={`shrink-0 rounded border px-3 py-2 ${section === item.id ? "border-primary text-primary" : "border-border"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {section === "overview" && isCholqui && (
        <nav aria-label="Vistas del resumen" className="flex gap-2 text-xs">
          {(["mapa", "satelite", "spv"] as const).map((key) => (
            <Link
              key={key}
              to="/projects/$projectId/$section"
              params={{ projectId, section: "overview" }}
              search={{ panel: key === "mapa" ? undefined : key, project: undefined }}
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
      <Suspense fallback={<p className="text-sm">Cargando módulo…</p>}>
        {section === "exploration" ? (
          <ProjectExploration key={projectId} projectId={projectId} />
        ) : section === "targets" ? (
          <ProjectTargets key={projectId} projectId={projectId} />
        ) : section === "validation" ? (
          <ProjectValidation key={projectId} projectId={projectId} />
        ) : !isCholqui || panel === "mapa" ? (
          <ProjectWorkspaceViewer
            key={projectId}
            projectId={projectId}
            mode={view}
            onModeChange={onViewChange}
          />
        ) : panel === "satelite" ? (
          <CholquiSatellitePanel />
        ) : (
          <CholquiSpvPanel projectCode={project.code} projectName={project.name} />
        )}
      </Suspense>
    </div>
  );
}
