import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { ProjectWorkspacePage } from "@/features/projects/workspace/ProjectWorkspacePage";
import { projectIdFromSearch } from "@/lib/projects/navigation";
import {
  projectWorkspaceSearch,
  projectWorkspaceSection,
  publishedTerminalDestination,
} from "@/lib/projects/workspace";

export const Route = createFileRoute("/_authenticated/projects/$projectId/$section")({
  validateSearch: projectWorkspaceSearch,
  beforeLoad: ({ params }) => {
    const projectId = projectIdFromSearch(params.projectId);
    const section = projectWorkspaceSection(params.section);
    if (!projectId || !section) {
      throw notFound();
    }
    const destination = publishedTerminalDestination(projectId, section);
    if (destination) {
      throw redirect({
        to: "/terminal/$slug",
        params: { slug: destination.slug },
        search: { tab: destination.tab, view: destination.view },
        replace: true,
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Workspace geocientífico de proyecto — Geocapitals" },
      {
        name: "description",
        content: "Territorio, evidencia geocientífica y documentos del proyecto en Geocapitals.",
      },
      { property: "og:title", content: "Workspace geocientífico de proyecto — Geocapitals" },
      {
        property: "og:description",
        content: "Territorio, evidencia geocientífica y documentos del proyecto en Geocapitals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
