// Edge Function: scan-concession-expirations
// Phase C — Scans every active concession across all projects and emits
// `expiring_soon` alerts at the 360 / 180 / 90 / 30-day thresholds.
// Idempotent: skips a (concession_id, bucket) pair already alerted in the
// last 14 days. Designed to be invoked daily by pg_cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = [
  { days: 30, severity: "critical" as const },
  { days: 90, severity: "critical" as const },
  { days: 180, severity: "warning" as const },
  { days: 360, severity: "info" as const },
];

const DEDUPE_WINDOW_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const now = Date.now();
  const horizon = new Date(now + 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);

  const { data: concessions, error } = await supabase
    .from("mining_concessions")
    .select("id, code, project_id, expires_at, status")
    .gte("expires_at", today)
    .lte("expires_at", horizon)
    .neq("status", "cancelada");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dedupeSince = new Date(now - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let created = 0;
  let skipped = 0;

  for (const c of concessions ?? []) {
    if (!c.expires_at) continue;
    const days = Math.round((new Date(c.expires_at).getTime() - now) / (24 * 60 * 60 * 1000));
    // Pick the tightest bucket the concession falls into
    const bucket = BUCKETS.find((b) => days <= b.days);
    if (!bucket) continue;

    const { data: existing } = await supabase
      .from("concession_alerts")
      .select("id, payload")
      .eq("concession_id", c.id)
      .eq("alert_type", "expiring_soon")
      .gte("created_at", dedupeSince)
      .limit(5);
    const alreadyForBucket = (existing ?? []).some(
      (e) => (e.payload as { bucket_days?: number } | null)?.bucket_days === bucket.days,
    );
    if (alreadyForBucket) {
      skipped++;
      continue;
    }

    await supabase.from("concession_alerts").insert({
      project_id: c.project_id,
      concession_id: c.id,
      alert_type: "expiring_soon",
      severity: bucket.severity,
      title: `Concesión ${c.code} vence en ${days} días`,
      message: `Vencimiento programado: ${c.expires_at}. Umbral ${bucket.days} días.`,
      payload: { bucket_days: bucket.days, days_remaining: days, expires_at: c.expires_at },
    });
    created++;
  }

  return new Response(
    JSON.stringify({
      ran_at: new Date().toISOString(),
      scanned: concessions?.length ?? 0,
      created,
      skipped,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
