import { useEffect, useState } from "react";
import { BrandButton } from "@/components/brand";
import { ContentState } from "@/components/ui-system";
import { Box, Map as MapIcon } from "lucide-react";
import { WorkspaceProjectLayers } from "./WorkspaceProjectLayers";
import { useProjects } from "@/hooks/useProjects";
import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";
import type { ProjectView } from "@/lib/projects/navigation";

/**
 * Shell geoespacial compartido. El visor 2D/3D y sus capas permanecen en
 * WorkspaceProjectLayers; aquí solo se controla la presentación y navegación.
 */
export function ProjectWorkspaceViewer({
  projectId,
  profile,
  title,
  twoD = "official_workbench",
  threeD = "official_3d",
  mode,
  defaultMode = "2d",
  onModeChange,
  showModeToggle = true,
  heightClassName = "min-h-[620px]",
  compactHeader = false,
}: {
  projectId: string;
  profile?: string;
  title?: string;
  twoD?: GeoViewerPresetId;
  threeD?: GeoViewerPresetId;
  mode?: ProjectView;
  defaultMode?: ProjectView;
  onModeChange?: (mode: ProjectView) => void;
  showModeToggle?: boolean;
  heightClassName?: string;
  compactHeader?: boolean;
}) {
  const { projects, active, setActiveId, loading } = useProjects();
  const [localMode, setLocalMode] = useState<ProjectView>(defaultMode);
  const view = mode ?? localMode;
  const project = projects.find((item) => item.id === projectId);
  const ready = Boolean(project && active?.id === projectId);

  useEffect(() => {
    if (project && active?.id !== projectId) setActiveId(projectId);
  }, [active?.id, project, projectId, setActiveId]);

  const changeMode = (nextMode: ProjectView) => {
    setLocalMode(nextMode);
    onModeChange?.(nextMode);
  };

  if (loading || (project && !ready)) {
    return (
      <div data-theme="im-light" className="rounded-xl border border-hairline bg-surface-3">
        <ContentState
          kind="loading"
          title="Activando proyecto…"
          description="Preparando las capas permitidas para este proyecto."
          className={`border-0 ${heightClassName}`}
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div data-theme="im-light" className="rounded-xl border border-hairline bg-surface-3">
        <ContentState
          kind="empty"
          title="Proyecto no disponible"
          description="Este proyecto no está disponible en tu workspace."
          className={`border-0 ${heightClassName}`}
        />
      </div>
    );
  }

  return (
    <section
      data-theme="im-light"
      className="overflow-hidden rounded-xl border border-hairline bg-surface-3 text-content"
      data-canonical-project-viewer={profile ?? "project"}
      data-geo-profile={profile}
      data-geo-mode={view}
      data-geo-preset={view === "2d" ? twoD : threeD}
      data-project-id={projectId}
    >
      {(!compactHeader || showModeToggle) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          {!compactHeader && (
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-subtle">
                GeoInteligencia · Visor de proyecto
              </p>
              <h2 className="truncate font-display text-xl font-normal text-content">
                {title ?? project.name}
              </h2>
            </div>
          )}
          {showModeToggle && (
            <div
              role="group"
              aria-label="Vista del proyecto"
              className="ml-auto inline-flex max-w-full flex-wrap gap-2"
            >
              {(["2d", "3d"] as const).map((key) => {
                const Icon = key === "2d" ? MapIcon : Box;
                return (
                  <BrandButton
                    key={key}
                    size="sm"
                    variant={view === key ? "primary" : "ghost"}
                    type="button"
                    onClick={() => changeMode(key)}
                    aria-pressed={view === key}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline px-4 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {key === "2d" ? "Planta" : "Perspectiva"}
                  </BrandButton>
                );
              })}
            </div>
          )}
        </header>
      )}
      <div data-surface="canvas" className={`relative ${heightClassName}`}>
        <WorkspaceProjectLayers key={project.id} project={project} view={view} />
      </div>
    </section>
  );
}
