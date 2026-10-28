// Public cron endpoint: triggers sync-catastro for all projects.
// Called by pg_cron daily. HMAC-validated via x-cron-secret header.
//
// To configure cron in Supabase:
//   SELECT cron.schedule('sync-catastro-daily', '0 6 * * *', $$
//     SELECT net.http_post(
//       url := 'https://geocapitals.com/api/public/sync-catastro',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', '<CRON_SECRET>'
//       ),
//       body := '{}'::jsonb
//     );
//   $$);

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  errorMessage,
  fetchWithTimeout,
  mapWithConcurrency,
  verifyCronSecret,
} from "@/lib/server/ingest";

const CONCURRENCY = 4;
const PER_PROJECT_TIMEOUT_MS = 50_000;
const PAGE = 1000;

export const Route = createFileRoute("/api/public/sync-catastro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyCronSecret(request, process.env.CRON_SECRET)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return new Response("server_misconfigured", { status: 500 });
        const supabase = createClient(url, key, { auth: { persistSession: false } });

        // Page through project ids only (narrow projection) instead of one 10k-row read.
        const ids = new Set<string>();
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("mining_concessions")
            .select("project_id")
            .not("project_id", "is", null)
            .order("project_id")
            .range(from, from + PAGE - 1);
          if (error) return Response.json({ error: error.message }, { status: 500 });
          for (const r of data ?? []) ids.add(r.project_id as string);
          if (!data || data.length < PAGE) break;
        }
        const projectIds = [...ids];
        const startedAt = Date.now();

        // Bounded concurrency + per-project timeout: one slow project can't stall the run.
        const results = await mapWithConcurrency(projectIds, CONCURRENCY, async (projectId) => {
          try {
            const res = await fetchWithTimeout(
              `${url}/functions/v1/sync-catastro`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({ projectId }),
              },
              PER_PROJECT_TIMEOUT_MS,
            );
            if (res.ok) return { projectId, ok: true as const };
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            return { projectId, ok: false as const, error: json.error ?? `HTTP ${res.status}` };
          } catch (e) {
            return { projectId, ok: false as const, error: errorMessage(e) };
          }
        });

        return Response.json({
          ok: true,
          projects: projectIds.length,
          failed: results.filter((r) => !r.ok).length,
          durationMs: Date.now() - startedAt,
          results,
          ranAt: new Date().toISOString(),
        });
      },
    },
  },
});
