import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado en /dashboard/project-report (detecta proyecto activo).
export const Route = createFileRoute("/_authenticated/dashboard/palmeras")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/project-report" });
  },
});
