import { createFileRoute, redirect } from "@tanstack/react-router";
import { canonicalProjectSlug } from "@/lib/projects/catalog";

// Visor 3D unificado: el relieve 3D de cada proyecto vive en su terminal (/terminal/$slug).
export const Route = createFileRoute("/visor-3d")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  beforeLoad: ({ search }) => {
    const slug = search.project ? canonicalProjectSlug(search.project) : null;
    if (slug) {
      throw redirect({
        to: "/terminal/$slug",
        params: { slug },
        search: { tab: "mapa" },
        replace: true,
        statusCode: 301,
      });
    }
    throw redirect({ to: "/proyectos", replace: true, statusCode: 301 });
  },
});
