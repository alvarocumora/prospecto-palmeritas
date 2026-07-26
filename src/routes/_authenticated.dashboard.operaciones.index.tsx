import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta deprecada. El spine canónico de operaciones es "Mesa de operaciones"
// (Trades). Redirigimos para no mantener dos fuentes de verdad.
export const Route = createFileRoute("/_authenticated/dashboard/operaciones/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/trades" });
  },
  component: () => null,
});
