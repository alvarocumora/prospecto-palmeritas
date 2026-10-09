import { useProjects } from "@/hooks/useProjects";
import { ProjectWorkspaceViewer } from "./ProjectWorkspaceViewer";
import {
  findProjectForProfile,
  getProjectViewerProfile,
  projectMatchesProfile,
  type CanonicalProjectKey,
} from "@/lib/geospatial/projectViewerProfiles";
import type { ProjectView } from "@/lib/projects/navigation";

export function CanonicalProjectViewer({
  profileKey,
  defaultMode = "2d",
  heightClassName = "h-[620px]",
  compactHeader = false,
}: {
  profileKey: CanonicalProjectKey;
  defaultMode?: ProjectView;
  heightClassName?: string;
  compactHeader?: boolean;
}) {
  const { projects, active, loading } = useProjects();
  const profile = getProjectViewerProfile(profileKey);
  const project =
    active && projectMatchesProfile(active, profileKey)
      ? active
      : findProjectForProfile(projects, profileKey);

  if (loading || !project) {
    return (
      <div
        className={`${heightClassName} grid place-items-center rounded border border-border p-6`}
      >
        {loading ? "Cargando proyecto…" : "Este proyecto no está disponible en tu workspace."}
      </div>
    );
  }

  return (
    <ProjectWorkspaceViewer
      key={project.id}
      projectId={project.id}
      profile={profile.key}
      title={profile.title}
      twoD={profile.twoD}
      threeD={profile.threeD}
      defaultMode={defaultMode}
      heightClassName={heightClassName}
      compactHeader={compactHeader}
    />
  );
}
