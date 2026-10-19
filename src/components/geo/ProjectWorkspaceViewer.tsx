import { useEffect, useState } from "react";
import { BrandButton } from "@/components/brand";
import { Box, Map as MapIcon } from "lucide-react";
import { WorkspaceProjectLayers } from "./WorkspaceProjectLayers";
import { useProjects } from "@/hooks/useProjects";
import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";
import type { ProjectView } from "@/lib/projects/navigation";

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
    return <div className={`${heightClassName} grid place-items-center`}>Activando proyecto…</div>;
  }
  if (!project) {
    return (
      <div className={`${heightClassName} grid place-items-center p-6 text-sm`}>
        Este proyecto no está disponible en tu workspace.
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded border border-border bg-background"
      data-canonical-project-viewer={profile ?? "project"}
      data-geo-profile={profile}
      data-geo-mode={view}
      data-geo-preset={view === "2d" ? twoD : threeD}
      data-project-id={projectId}
    >
      {(!compactHeader || showModeToggle) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          {!compactHeader && <h2 className="text-sm font-semibold">{title ?? project.name}</h2>}
          {showModeToggle && (
            <div className="ml-auto flex gap-1">
              {(["2d", "3d"] as const).map((key) => {
                const Icon = key === "2d" ? MapIcon : Box;
                return (
                  <BrandButton
                    size="sm"
                    variant={view === key ? "primary" : "ghost"}
                    key={key}
                    type="button"
                    onClick={() => changeMode(key)}
                    aria-pressed={view === key}
                    className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs ${
                      view === key ? "border-primary text-primary" : "border-border"
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {key === "2d" ? "Planta" : "Perspectiva"}
                  </BrandButton>
                );
              })}
            </div>
          )}
        </header>
      )}
      <div className={`relative min-h-[620px]`}>
        <WorkspaceProjectLayers key={project.id} project={project} view={view} />
      </div>
    </section>
  );
}
