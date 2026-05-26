import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado en /dashboard/map (mapa táctico único, modo campo via toggle).
export const Route = createFileRoute("/_authenticated/dashboard/field-map")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/map" });
  },
});
