import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/operaciones/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/trades" });
  },
  component: () => null,
});
