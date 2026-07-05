// Public stats endpoint — JSON KPIs for landing, external monitoring & cron.
// CORS-enabled, cached 60s. No auth required, no PII.
import { createFileRoute } from "@tanstack/react-router";
import { getPlatformStats } from "@/lib/platformStats.functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=60, s-maxage=60",
};

export const Route = createFileRoute("/api/public/stats")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          const stats = await getPlatformStats();
          return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "stats_unavailable", message: String(err) }),
            { status: 503, headers: { "content-type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
