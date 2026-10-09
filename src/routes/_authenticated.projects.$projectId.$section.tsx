import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProjectWorkspacePage } from "@/features/projects/workspace/ProjectWorkspacePage";
import { projectIdFromSearch } from "@/lib/projects/navigation";
import { projectWorkspaceSearch, projectWorkspaceSection } from "@/lib/projects/workspace";

export const Route = createFileRoute("/_authenticated/projects/$projectId/$section")({
  validateSearch: projectWorkspaceSearch,
  beforeLoad: ({ params }) => {
    if (!projectIdFromSearch(params.projectId) || !projectWorkspaceSection(params.section)) {
      throw notFound();
    }
  },
  head: () => ({ meta: [{ title: "Workspace de proyecto — Geocapitals" }] }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { projectId, section: requestedSection } = Route.useParams();
  const section = projectWorkspaceSection(requestedSection);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!section) return null;

  return (
    <ProjectWorkspacePage
      projectId={projectId}
      section={section}
      search={search}
      onViewChange={(view) => {
        void navigate({
          params: { projectId, section: view === "3d" ? "model" : "overview" },
          search: { view, project: undefined },
        });
      }}
    />
  );
}
