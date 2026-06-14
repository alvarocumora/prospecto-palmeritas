// Public cron endpoint: detects satellite anomalies created in the last window
// and emails project members (internal template). Triggered by pg_cron hourly.
// Auth: apikey header must match the Supabase anon/publishable key.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notifications/satellite-anomalies")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const apiKey =
          request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        if (!expectedKey || apiKey !== expectedKey) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
        if (!url || !key) {
          return Response.json({ error: "server_misconfigured" }, { status: 500 });
        }
        const admin = createClient(url, key);

        const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

        const { data: rows, error } = await admin
          .from("satellite_anomalies")
          .select("id, project_id, score, severity, index_code, detected_at, created_at, run_id")
          .gte("created_at", sinceIso)
          .not("project_id", "is", null)
          .limit(2000);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        // Group by project
        const byProject = new Map<string, typeof rows>();
        for (const a of rows ?? []) {
          const arr = byProject.get(a.project_id!) ?? [];
          arr.push(a);
          byProject.set(a.project_id!, arr);
        }

        let queued = 0;
        for (const [projectId, anomalies] of byProject) {
          const top = [...anomalies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
          const { data: project } = await admin
            .from("projects")
            .select("id, name, code")
            .eq("id", projectId)
            .maybeSingle();
          const { data: members } = await admin
            .from("project_members")
            .select("user_id")
            .eq("project_id", projectId);
          const userIds = (members ?? []).map((m) => m.user_id);
          if (userIds.length === 0) continue;
          const { data: profs } = await admin
            .from("profiles")
            .select("user_id, email, display_name")
            .in("user_id", userIds);
          const dayKey = new Date().toISOString().slice(0, 10);
          for (const p of profs ?? []) {
            if (!p.email) continue;
            const r = await sendInternalEmail({
              templateName: "satellite-anomaly-internal",
              recipientEmail: p.email,
              idempotencyKey: `sat-anom:${projectId}:${dayKey}:${p.user_id}`,
              templateData: {
                recipientName: p.display_name,
                projectName: project?.name,
                projectId,
                anomalyCount: anomalies.length,
                topScore: top?.score,
                topIndex: top?.index_code,
                topSeverity: top?.severity,
                detectedAt: top?.detected_at ?? top?.created_at,
                runId: top?.run_id,
              },
            });
            if (r.ok && "queued" in r && r.queued) queued++;
          }
        }

        return Response.json({ ok: true, projects: byProject.size, queued });
      },
    },
  },
});
