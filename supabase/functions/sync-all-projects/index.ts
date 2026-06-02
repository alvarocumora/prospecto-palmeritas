// Edge Function: sync-all-projects
// Phase D — Dispatcher invoked daily by pg_cron. Iterates over every project
// that has at least one mining_concession with source='sernageomin' (or any
// concession with an external_id), and triggers `sync-catastro` for each one
// using the service role JWT. Returns a per-project summary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await supabase
    .from("mining_concessions")
    .select("project_id")
    .not("external_id", "is", null);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const projectIds = Array.from(new Set((rows ?? []).map((r) => r.project_id)));

  const results: Array<{ projectId: string; ok: boolean; summary?: unknown; error?: string }> = [];
  // Sequential to respect the ~10 req/s rate limit of services1.arcgis.com
  for (const projectId of projectIds) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-catastro`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });
      const summary = await res.json().catch(() => ({}));
      results.push({ projectId, ok: res.ok, summary });
    } catch (e) {
      results.push({
        projectId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({
      ran_at: new Date().toISOString(),
      total: projectIds.length,
      ok: results.filter((r) => r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
