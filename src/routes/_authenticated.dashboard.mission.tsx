import { createFileRoute, redirect } from "@tanstack/react-router";

// Mission Control se fusionó con el Terminal único de proyectos (2D/3D, tesis, informes).
export const Route = createFileRoute("/_authenticated/dashboard/mission")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal", replace: true });
  },
});
