import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { canonicalProjectSlug } from "@/lib/projects/catalog";
import {
  getTerminalProject,
  isTerminalTab,
  type TerminalTabKey,
} from "@/features/terminal/terminalProjects";
import { ProjectTerminalShell } from "@/features/terminal/ProjectTerminalShell";
import { projectView, type ProjectView } from "@/lib/projects/navigation";
import { MarketingPage } from "@/features/marketing/MarketingShell";

export const Route = createFileRoute("/terminal_/$slug")({
  validateSearch: (search: Record<string, unknown>): { tab: TerminalTabKey; view?: ProjectView } => ({
    tab: isTerminalTab(search.tab) ? search.tab : "mapa",
    view: search.view == null ? undefined : projectView(search.view),
  }),
  beforeLoad: ({ params, search }) => {
    const canonical = canonicalProjectSlug(params.slug);
    if (canonical && canonical !== params.slug) {
      throw redirect({
        to: "/terminal/$slug",
        params: { slug: canonical },
        search,
        replace: true,
        statusCode: 301,
      });
    }
  },
  head: ({ params }) => {
    const project = getTerminalProject(params.slug);
    const title = project
      ? `${project.name} · Terminal de inversión — Geocapitals`
      : "Terminal de inversión — Geocapitals";
    const description = project
      ? `${project.name} (${project.ficha.commodity}) en una sola pantalla: mapa de exploración, tesis y ensayes, simulador de ticket y data room.`
      : "Terminal de inversión minera de Geocapitals.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TerminalPage,
});

function TerminalPage() {
  const { slug } = Route.useParams();
  const { tab, view } = Route.useSearch();
  const project = getTerminalProject(slug);

  if (!project) {
    return (
      <MarketingPage eyebrow="Terminal" title="Proyecto no encontrado">
        <p className="text-content-subtle text-sm">
          Este proyecto no tiene un terminal de inversión publicado.
        </p>
        <Link
          to="/proyectos"
          className="mt-4 inline-block text-accent-brand text-sm hover:underline"
        >
          Ver todos los proyectos
        </Link>
      </MarketingPage>
    );
  }

  return <ProjectTerminalShell key={project.slug} project={project} tab={tab} view={projectView(view)} />;
}
