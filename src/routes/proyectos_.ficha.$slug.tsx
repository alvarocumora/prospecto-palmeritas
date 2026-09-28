import { createFileRoute, redirect } from "@tanstack/react-router";
import { canonicalProjectSlug } from "@/lib/projects/catalog";

// La ficha de inversión dejó de ser una página aparte: ahora vive dentro del
// Terminal unificado (/terminal/$slug). Mantenemos la URL antigua con
// redirección permanente para no romper enlaces publicados.
export const Route = createFileRoute("/proyectos_/ficha/$slug")({
  beforeLoad: ({ params }) => {
    const canonical = canonicalProjectSlug(params.slug);
    throw redirect({
      to: "/terminal/$slug",
      params: { slug: canonical ?? params.slug },
      search: { tab: "tesis" as const },
      replace: true,
      statusCode: 301,
    });
  },
});
