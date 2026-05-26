import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidado en Mission Control (/dashboard) — Centro de Mando único.
export const Route = createFileRoute("/_authenticated/dashboard/command-center")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
