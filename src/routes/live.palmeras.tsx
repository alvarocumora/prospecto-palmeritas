import { createFileRoute, redirect } from "@tanstack/react-router";

// Vista pública unificada: toda ficha de proyecto vive en el Terminal (/terminal/$slug).
export const Route = createFileRoute("/live/palmeras")({
  beforeLoad: () => {
    throw redirect({
      to: "/terminal/$slug",
      params: { slug: "palmeras" },
      search: { tab: "mapa" },
      replace: true,
      statusCode: 301,
    });
  },
});
