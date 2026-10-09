import { Link, Navigate } from "@tanstack/react-router";
import { useProjects } from "@/hooks/useProjects";
import {
  findProjectForProfile,
  projectMatchesProfile,
  type CanonicalProjectKey,
} from "@/lib/geospatial/projectViewerProfiles";

export function LegacyProjectEntry({ profileKey }: { profileKey: CanonicalProjectKey }) {
  const { projects, active, loading } = useProjects();
  const project =
    active && projectMatchesProfile(active, profileKey)
      ? active
      : findProjectForProfile(projects, profileKey);

  if (loading) return <div className="p-6 text-sm">Cargando proyecto…</div>;
  if (!project) {
    return (
      <div className="p-6 text-sm">
        <p>Este proyecto no está disponible en tu workspace.</p>
        <Link to="/dashboard/projects" className="text-primary underline">
          Volver a proyectos
        </Link>
      </div>
    );
  }
  return (
    <Navigate
      to="/projects/$projectId/$section"
      params={{ projectId: project.id, section: "overview" }}
      search={{ project: undefined }}
      replace
    />
  );
}
