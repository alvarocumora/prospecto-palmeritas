import { createFileRoute, redirect } from "@tanstack/react-router";

// Unificado con la ruta principal pública. El catastro por proyecto ahora
// vive bajo /catastro/proyecto (misma navegación que /catastro/mapa y planes)
// para eliminar la duplicación con el catastro público.
export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  beforeLoad: () => {
    throw redirect({ to: "/catastro/proyecto" });
  },
});
