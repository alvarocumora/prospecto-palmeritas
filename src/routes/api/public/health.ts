// Stable health endpoint — does NOT touch DB. Safe for uptime monitors and CI smoke tests.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          ts: new Date().toISOString(),
          commit: process.env.CF_PAGES_COMMIT_SHA ?? process.env.GIT_COMMIT ?? "dev",
        }),
    },
  },
});
