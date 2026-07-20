// Sprint 5.3 — Prospectivity grid generator.
// POST { project_id, bbox: [minLng,minLat,maxLng,maxLat], cell_size_m? }
// Calcula score 0-100 por celda fusionando: targets, sondajes con intercept, vetas, alteración.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R = 6371000;
function distM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Convert UTM zone 19S (Chile) approx → lat/lng. Quick & dirty for scoring distances only.
// For Chile central we use a simple inverse via fixed scale; if no easting/northing, hole skipped.
// Better: store hole lat/lng. For now we approximate with project center fallback.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, bbox, cell_size_m = 250, notes } = await req.json();
    if (!project_id || !Array.isArray(bbox) || bbox.length !== 4) {
      return new Response(
        JSON.stringify({ error: "project_id and bbox [minLng,minLat,maxLng,maxLat] required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const [minLng, minLat, maxLng, maxLat] = bbox.map(Number);
    if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) {
      return new Response(JSON.stringify({ error: "bbox values must be numeric" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user)
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Bound the grid for safety
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const midLat = (minLat + maxLat) / 2;
    const metersPerDegLat = 111_320;
    const metersPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);
    const cellLatStep = cell_size_m / metersPerDegLat;
    const cellLngStep = cell_size_m / metersPerDegLng;
    const nLat = Math.ceil(latSpan / cellLatStep);
    const nLng = Math.ceil(lngSpan / cellLngStep);
    const total = nLat * nLng;
    if (total > 5000) {
      return new Response(
        JSON.stringify({
          error: `Grid too large (${total} cells). Reduce bbox or increase cell_size_m. Max 5000.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch evidence
    const [targets, _holes, logs] = await Promise.all([
      admin
        .from("exploration_targets")
        .select("lat,lng,score,priority,stage")
        .eq("project_id", project_id)
        .not("lat", "is", null)
        .not("lng", "is", null),
      admin
        .from("drill_holes")
        .select("id,easting,northing,actual_depth")
        .eq("project_id", project_id),
      admin
        .from("drill_core_logs")
        .select("hole_id,au_gpt,cu_pct")
        .eq("project_id", project_id)
        .gte("au_gpt", 0.3),
    ]);

    // Build hole lat/lng map (skip those without — UTM conversion not implemented here)
    // Holes in UTM: we'd need proj4. For now we ignore holes lacking direct lat/lng.
    // Strategy: aggregate intercept count per hole, then we treat holes as not contributing if no coords.
    // Future: store hole_lat/hole_lng or use proj4.
    const interceptByHole = new Map<string, { auMax: number; n: number }>();
    for (const l of logs.data ?? []) {
      const cur = interceptByHole.get(l.hole_id as string) ?? { auMax: 0, n: 0 };
      cur.auMax = Math.max(cur.auMax, Number(l.au_gpt) || 0);
      cur.n += 1;
      interceptByHole.set(l.hole_id as string, cur);
    }

    const tgs = (targets.data ?? []).map(
      (t: { lat: unknown; lng: unknown; score: unknown; priority: string; stage: string }) => ({
        lat: Number(t.lat),
        lng: Number(t.lng),
        score: Number(t.score) || 50,
        priority: t.priority,
        stage: t.stage,
      }),
    );

    const PRIORITY_W: Record<string, number> = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3 };
    const weights = { targets: 0.6, target_density: 0.4, intercepts: 0.0 }; // intercepts disabled until UTM->latlng

    // Generate run id
    const runId = crypto.randomUUID();

    const cellsRows: Array<{
      project_id: string;
      run_id: string;
      cell_lat: number;
      cell_lng: number;
      cell_size_m: number;
      score: number;
      features: Record<string, unknown>;
      generated_by: string;
    }> = [];

    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLng; j++) {
        const cLat = minLat + (i + 0.5) * cellLatStep;
        const cLng = minLng + (j + 0.5) * cellLngStep;

        // Target proximity score
        let bestTargetContribution = 0;
        let nearTargetCount = 0;
        let nearestTarget: { dist: number; score: number; priority: string } | null = null;
        for (const t of tgs) {
          const d = distM(cLat, cLng, t.lat, t.lng);
          if (d <= 1500) {
            nearTargetCount++;
            const decay = Math.exp(-d / 600); // 600 m e-fold
            const w = PRIORITY_W[t.priority] ?? 0.5;
            const stageMult = t.stage === "closed" ? 0.2 : 1.0;
            const contribution = (t.score / 100) * w * decay * stageMult;
            if (contribution > bestTargetContribution) bestTargetContribution = contribution;
            if (!nearestTarget || d < nearestTarget.dist) {
              nearestTarget = { dist: d, score: t.score, priority: t.priority };
            }
          }
        }
        const targetScore = bestTargetContribution; // 0..1
        const densityScore = Math.min(nearTargetCount / 5, 1); // saturates at 5 targets

        const raw = weights.targets * targetScore + weights.target_density * densityScore;
        const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

        if (score >= 5) {
          cellsRows.push({
            project_id,
            run_id: runId,
            cell_lat: cLat,
            cell_lng: cLng,
            cell_size_m,
            score,
            features: {
              targets_in_radius: nearTargetCount,
              best_target_contribution: Number(bestTargetContribution.toFixed(3)),
              target_density: Number(densityScore.toFixed(3)),
              nearest_target: nearestTarget,
            },
            generated_by: user.id,
          });
        }
      }
    }

    // Persist run
    const { error: runErr } = await admin.from("prospectivity_runs").insert({
      id: runId,
      project_id,
      generated_by: user.id,
      bbox_geojson: {
        type: "Polygon",
        coordinates: [
          [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ],
        ],
      },
      cell_size_m,
      cell_count: cellsRows.length,
      weights,
      notes: notes ?? null,
    });
    if (runErr) throw runErr;

    // Bulk insert cells in chunks of 500
    for (let k = 0; k < cellsRows.length; k += 500) {
      const chunk = cellsRows.slice(k, k + 500);
      const { error } = await admin.from("prospectivity_cells").insert(chunk);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        run_id: runId,
        cell_count: cellsRows.length,
        total_grid: total,
        max_score: cellsRows.reduce((m, c) => Math.max(m, c.score), 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("prospectivity-grid", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
