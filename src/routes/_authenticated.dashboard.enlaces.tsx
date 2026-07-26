import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta deprecada: los enlaces a proveedores/contraparte se emiten hoy desde el
// detalle del trade (Mesa de operaciones). Redirigimos para consolidar el flujo.
export const Route = createFileRoute("/_authenticated/dashboard/enlaces")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/trades" });
  },
  component: () => null,
});
