import { createFileRoute, redirect } from "@tanstack/react-router";

// Ficha única: Cholqui vive en el terminal canónico (/terminal/cholqui).
export const Route = createFileRoute("/_authenticated/dashboard/cholqui")({
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
