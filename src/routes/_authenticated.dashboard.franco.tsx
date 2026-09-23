import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias histórico: el nombre público y privado canónico es Cholqui.
export const Route = createFileRoute("/_authenticated/dashboard/franco")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/cholqui", replace: true });
  },
});
