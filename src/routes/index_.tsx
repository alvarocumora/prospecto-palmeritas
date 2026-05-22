import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias /index -> / para evitar 404 en bookmarks o links externos antiguos.
export const Route = createFileRoute("/index_")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
