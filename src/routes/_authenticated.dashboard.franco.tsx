import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias histórico de Cholqui → terminal canónico.
export const Route = createFileRoute("/_authenticated/dashboard/franco")({
  beforeLoad: () => {
    throw redirect({
      to: "/terminal/$slug",
      params: { slug: "cholqui" },
      search: { tab: "mapa" },
      replace: true,
      statusCode: 301,
    });
  },
});
