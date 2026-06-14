// Public cron endpoint: scans concessions whose expires_at is within thresholds
// and emails project members (internal template). Triggered by pg_cron daily.
// Auth: apikey header must match the Supabase anon/publishable key.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notifications/catastro-expirations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
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

        const now = new Date();
        const horizon = new Date(now);
        horizon.setDate(horizon.getDate() + 60);

        const { data: rows, error } = await admin
          .from("mining_concessions")
          .select(
            "id, code, name, holder, region, area_ha, expires_at, project_id, projects:project_id(name, code)",
          )
          .not("project_id", "is", null)
          .not("expires_at", "is", null)
          .lte("expires_at", horizon.toISOString().slice(0, 10))
          .gte("expires_at", new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10))
          .limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const queued: string[] = [];
        const skipped: string[] = [];
        for (const c of rows ?? []) {
          const exp = c.expires_at ? new Date(c.expires_at) : null;
          const days = exp ? Math.ceil((exp.getTime() - now.getTime()) / 86400000) : null;
          if (days === null) continue;
          if (![30, 15, 7, 1, 0, -1].includes(days)) {
            skipped.push(c.id);
            continue;
          }
          // Resolve project members
          const { data: members } = await admin
            .from("project_members")
            .select("user_id, role")
            .eq("project_id", c.project_id);
          const userIds = (members ?? []).map((m) => m.user_id);
          if (userIds.length === 0) continue;
          const { data: profs } = await admin
            .from("profiles")
            .select("user_id, email, display_name")
            .in("user_id", userIds);
          const project =
            (c as unknown as { projects?: { name?: string; code?: string } | null }).projects ??
            null;
          for (const p of profs ?? []) {
            if (!p.email) continue;
            const r = await sendInternalEmail({
              templateName: "catastro-expiration-internal",
              recipientEmail: p.email,
              idempotencyKey: `catastro-exp:${c.id}:${days}:${p.user_id}`,
              templateData: {
                recipientName: p.display_name,
                projectName: project?.name,
                projectCode: project?.code,
                concessionCode: c.code,
                concessionName: c.name,
                holder: c.holder,
                expiresAt: c.expires_at,
                daysRemaining: days,
                region: c.region,
                areaHa: c.area_ha,
                concessionId: c.id,
              },
            });
            if (r.ok && "queued" in r && r.queued) queued.push(p.email);
          }
        }

        return Response.json({
          ok: true,
          scanned: rows?.length ?? 0,
          queued: queued.length,
          skipped: skipped.length,
        });
      },
    },
  },
});
