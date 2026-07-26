import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta deprecada: las invitaciones a socios se gestionan hoy desde Clientes.
export const Route = createFileRoute("/_authenticated/dashboard/invitaciones")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clientes" });
  },
  component: () => null,
});
