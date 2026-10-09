import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useProjects } from "@/hooks/useProjects";
import {
  PROJECT_WORKSPACE_SECTIONS,
  projectWorkspaceSearch,
  type ProjectWorkspaceSection,
} from "@/lib/projects/workspace";

export function LegacyWorkspaceEntry({ section }: { section: ProjectWorkspaceSection }) {
  const { active, loading } = useProjects();
  const location = useLocation();
  const search = projectWorkspaceSearch(location.search);
  const destination = section === "overview" && search.view === "3d" ? "model" : section;
  const legacyPath = PROJECT_WORKSPACE_SECTIONS.find((item) => item.id === section)?.legacyPath;

  if (location.pathname.replace(/\/$/, "") !== legacyPath) return <Outlet />;
  if (loading) return <div className="p-6 text-sm">Cargando proyecto…</div>;
  if (!active) {
    return (
      <div className="p-6 text-sm">
        <p>Selecciona un proyecto para abrir su workspace.</p>
        <Link to="/dashboard/projects" className="text-primary underline">
          Ir a proyectos
        </Link>
      </div>
    );
  }
  return (
    <Navigate
      to="/projects/$projectId/$section"
      params={{ projectId: active.id, section: destination }}
      search={{ ...search, project: undefined }}
      hash={location.hash.replace(/^#/, "")}
      replace
    />
  );
}
