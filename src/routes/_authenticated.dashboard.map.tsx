import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublicProjectById } from "@/lib/projects/catalog";

export const Route = createFileRoute("/_authenticated/dashboard/map")({
  beforeLoad: ({ search }) => {
    const published = search.project ? getPublicProjectById(search.project) : null;
    if (published)
      throw redirect({
        to: "/terminal/$slug",
        params: { slug: published.slug },
        search: { tab: "mapa", view: "2d" },
        replace: true,
      });
    throw redirect({
      to: "/catastro/mapa",
      search: { vista: "proyecto", project: search.project },
      replace: true,
    });
  },
});
