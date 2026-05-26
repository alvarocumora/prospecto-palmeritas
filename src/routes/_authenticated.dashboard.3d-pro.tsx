import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado en /dashboard/geology3d (visor 3D canónico).
export const Route = createFileRoute("/_authenticated/dashboard/3d-pro")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/geology3d" });
  },
});
