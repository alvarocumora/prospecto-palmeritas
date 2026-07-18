import { createFileRoute, redirect } from "@tanstack/react-router";

// Unificado bajo /catastro/proyecto/titulares/$id
export const Route = createFileRoute("/_authenticated/dashboard/catastro/holders/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/catastro/proyecto/titulares/$id",
      params: { id: params.id },
    });
  },
});
