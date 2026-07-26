import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta deprecada: las tarifas de flete están integradas en el flujo de Envíos.
export const Route = createFileRoute("/_authenticated/dashboard/fletes")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/envios" });
  },
  component: () => null,
});
