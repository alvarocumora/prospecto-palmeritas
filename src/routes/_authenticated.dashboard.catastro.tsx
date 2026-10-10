import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  beforeLoad: () => {
    throw redirect({ to: "/catastro/mapa", search: { vista: "explorar" }, replace: true });
  },
});
