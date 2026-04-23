// Public cron endpoint: triggers sync-catastro for all projects.
// Called by pg_cron daily. HMAC-validated via x-cron-secret header.
//
// To configure cron in Supabase:
//   SELECT cron.schedule('sync-catastro-daily', '0 6 * * *', $$
//     SELECT net.http_post(
//       url := 'https://prospecto-palmeritas.lovable.app/api/public/sync-catastro',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', '<CRON_SECRET>'
//       ),
//       body := '{}'::jsonb
//     );
//   $$);

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/sync-catastro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!cronSecret || !provided || provided !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // Get all projects that have at least one mining concession
        const { data: projects, error } = await supabase
          .from("mining_concessions")
          .select("project_id")
          .limit(10000);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const uniqueProjectIds = Array.from(
          new Set((projects ?? []).map((r) => r.project_id as string)),
        );

        const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];

        for (const projectId of uniqueProjectIds) {
          try {
            const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/sync-catastro`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ projectId }),
            });
            const json = await res.json();
            results.push({ projectId, ok: res.ok, ...(res.ok ? {} : { error: json.error }) });
          } catch (e) {
            results.push({ projectId, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        return Response.json({
          ok: true,
          projects: uniqueProjectIds.length,
          results,
          ranAt: new Date().toISOString(),
        });
      },
    },
  },
});
