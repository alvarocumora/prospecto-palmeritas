import { createFileRoute, redirect } from "@tanstack/react-router";

// Ficha única: Las Palmeras vive en el terminal canónico (/terminal/palmeras).
export const Route = createFileRoute("/_authenticated/dashboard/palmeras")({
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
