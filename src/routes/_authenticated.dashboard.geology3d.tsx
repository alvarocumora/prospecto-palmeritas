import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado: el relieve 3D vive dentro de cada ficha de proyecto.
export const Route = createFileRoute("/_authenticated/dashboard/geology3d")({
  beforeLoad: () => {
    throw redirect({ to: "/proyectos", statusCode: 301 });
  },
});
