import { createFileRoute, redirect } from "@tanstack/react-router";

// Visor unificado: /live/tilama → /live/losverdes (mismo prospecto).
export const Route = createFileRoute("/live/tilama")({
  beforeLoad: () => {
    throw redirect({
      to: "/terminal/$slug",
      params: { slug: "losverdes" },
      search: { tab: "mapa" },
      replace: true,
      statusCode: 301,
    });
  },
});
