// Resource Estimation engine (IDW + Nearest Neighbour) — runs on Supabase Edge Functions (Deno).
// Composites drill core logs at fixed length, builds a 3D block model inside the
// bounding box of the composites, and estimates grades using IDW (default) or NN.
//
// NOTE on geostats library choice:
// GeostatsPy / PyKrige are Python-only and require numpy/scipy native binaries.
// Supabase Edge Functions run on Deno, where Python is not available.
// We implement IDW + NN natively in TypeScript — these are the most-used estimators
// in early-stage exploration and produce auditable, NI 43-101 / JORC compatible numbers.
// Ordinary Kriging requires a fitted variogram model; that's planned for a follow-up
// service running on a Python worker (out of scope for this edge function).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EstimateRequest {
  model_id: string;
}

interface CoreLog {
  hole_id: string;
  depth_from: number;
  depth_to: number;
  au_gpt: number | null;
  ag_gpt: number | null;
  cu_pct: number | null;
}

interface Hole {
  id: string;
  hole_id: string;
  easting: number | null;
  northing: number | null;
  elevation: number | null;
  azimuth: number | null;
  dip: number | null;
}

interface Composite {
  hole_id: string;
  hole_code: string;
  depth_from: number;
  depth_to: number;
  length_m: number;
  grade: number;
  x: number;
  y: number;
  z: number;
}

function getCommodityColumn(c: string): keyof CoreLog {
  if (c === "au") return "au_gpt";
  if (c === "ag") return "ag_gpt";
  if (c === "cu") return "cu_pct";
  return "au_gpt";
}

/** Project a depth along a hole given collar coords + azimuth/dip. */
function projectDepth(
  hole: Hole,
  depth: number,
): { x: number; y: number; z: number } | null {
  if (hole.easting == null || hole.northing == null || hole.elevation == null) return null;
  const az = ((hole.azimuth ?? 0) * Math.PI) / 180;
  const dipDown = ((hole.dip ?? -90) * Math.PI) / 180; // dip negative = downward
  const horiz = Math.cos(dipDown) * depth; // negative dip → small horizontal component
  const vert = Math.sin(dipDown) * depth; // negative dip → negative vert
  return {
    x: hole.easting + horiz * Math.sin(az),
    y: hole.northing + horiz * Math.cos(az),
    z: hole.elevation + vert,
  };
}

/** Composite core logs to fixed-length intervals (length-weighted average). */
function compositeIntervals(logs: CoreLog[], holes: Map<string, Hole>, commodityCol: keyof CoreLog, length: number): Composite[] {
  // Group by hole, sort by depth_from
  const byHole = new Map<string, CoreLog[]>();
  for (const l of logs) {
    if (l[commodityCol] == null) continue;
    if (!byHole.has(l.hole_id)) byHole.set(l.hole_id, []);
    byHole.get(l.hole_id)!.push(l);
  }
  const out: Composite[] = [];
  for (const [holeId, intervals] of byHole) {
    const hole = holes.get(holeId);
    if (!hole) continue;
    intervals.sort((a, b) => a.depth_from - b.depth_from);
    const minDepth = intervals[0].depth_from;
    const maxDepth = intervals[intervals.length - 1].depth_to;
    let cursor = minDepth;
    while (cursor < maxDepth) {
      const cTo = Math.min(cursor + length, maxDepth);
      let sumGradeLen = 0;
      let totalLen = 0;
      for (const iv of intervals) {
        const overlap = Math.min(iv.depth_to, cTo) - Math.max(iv.depth_from, cursor);
        if (overlap <= 0) continue;
        const g = Number(iv[commodityCol]);
        if (!Number.isFinite(g)) continue;
        sumGradeLen += g * overlap;
        totalLen += overlap;
      }
      if (totalLen > 0) {
        const grade = sumGradeLen / totalLen;
        const midDepth = (cursor + cTo) / 2;
        const pos = projectDepth(hole, midDepth);
        if (pos) {
          out.push({
            hole_id: holeId,
            hole_code: hole.hole_id,
            depth_from: cursor,
            depth_to: cTo,
            length_m: cTo - cursor,
            grade,
            ...pos,
          });
        }
      }
      cursor = cTo;
    }
  }
  return out;
}

interface ModelParams {
  method: "idw" | "ok" | "nn";
  search_radius: number;
  min_samples: number;
  max_samples: number;
  power: number;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
  density_t_m3: number;
  cutoff_grade: number | null;
}

interface BlockOut {
  ix: number; iy: number; iz: number;
  x: number; y: number; z: number;
  grade: number | null;
  variance: number | null;
  n_samples: number;
  nearest_dist: number | null;
  classification: string | null;
}

function estimateBlocks(composites: Composite[], params: ModelParams): {
  blocks: BlockOut[];
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
} {
  const xs = composites.map((c) => c.x);
  const ys = composites.map((c) => c.y);
  const zs = composites.map((c) => c.z);
  // Pad bbox by 1 search radius
  const pad = params.search_radius;
  const bbox = {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minY: Math.min(...ys) - pad,
    maxY: Math.max(...ys) + pad,
    minZ: Math.min(...zs) - pad,
    maxZ: Math.max(...zs) + pad,
  };
  const nx = Math.max(1, Math.ceil((bbox.maxX - bbox.minX) / params.block_size_x));
  const ny = Math.max(1, Math.ceil((bbox.maxY - bbox.minY) / params.block_size_y));
  const nz = Math.max(1, Math.ceil((bbox.maxZ - bbox.minZ) / params.block_size_z));
  const totalBlocks = nx * ny * nz;
  if (totalBlocks > 250_000) {
    throw new Error(`Block count ${totalBlocks} exceeds 250,000 — increase block size or shrink AOI.`);
  }
  const blocks: BlockOut[] = [];
  for (let ix = 0; ix < nx; ix++) {
    const cx = bbox.minX + (ix + 0.5) * params.block_size_x;
    for (let iy = 0; iy < ny; iy++) {
      const cy = bbox.minY + (iy + 0.5) * params.block_size_y;
      for (let iz = 0; iz < nz; iz++) {
        const cz = bbox.minZ + (iz + 0.5) * params.block_size_z;
        // Find composites within search radius
        const neighbours: Array<{ d: number; g: number }> = [];
        for (const c of composites) {
          const dx = c.x - cx, dy = c.y - cy, dz = c.z - cz;
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (d <= params.search_radius) neighbours.push({ d, g: c.grade });
        }
        neighbours.sort((a, b) => a.d - b.d);
        const used = neighbours.slice(0, params.max_samples);
        const nearest = used[0]?.d ?? null;
        if (used.length < params.min_samples) {
          blocks.push({
            ix, iy, iz, x: cx, y: cy, z: cz,
            grade: null, variance: null,
            n_samples: used.length, nearest_dist: nearest, classification: null,
          });
          continue;
        }
        let grade: number;
        if (params.method === "nn" || used.length === 1) {
          grade = used[0].g;
        } else {
          // IDW
          let num = 0, den = 0;
          for (const u of used) {
            const w = 1 / Math.pow(Math.max(u.d, 0.01), params.power);
            num += w * u.g;
            den += w;
          }
          grade = num / den;
        }
        // Simple variance proxy: weighted variance of the used grades
        const mean = used.reduce((a, b) => a + b.g, 0) / used.length;
        const variance = used.reduce((a, b) => a + (b.g - mean) ** 2, 0) / used.length;
        // Classification: measured if nearest <= 1/3 radius and n>=4 ; indicated if nearest <= 2/3 and n>=2; else inferred
        const nd = nearest ?? params.search_radius;
        const cls =
          nd <= params.search_radius / 3 && used.length >= 4 ? "measured" :
          nd <= (params.search_radius * 2) / 3 && used.length >= 2 ? "indicated" :
          "inferred";
        blocks.push({
          ix, iy, iz, x: cx, y: cy, z: cz,
          grade, variance,
          n_samples: used.length, nearest_dist: nearest, classification: cls,
        });
      }
    }
  }
  return { blocks, bbox };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { model_id } = (await req.json()) as EstimateRequest;
    if (!model_id) throw new Error("model_id required");

    // 1) Fetch model
    const { data: model, error: mErr } = await supabase
      .from("resource_models").select("*").eq("id", model_id).single();
    if (mErr || !model) throw new Error("Model not found");

    await supabase.from("resource_models").update({ status: "running" }).eq("id", model_id);

    // 2) Fetch holes for project (optionally filtered by campaign)
    const holesQuery = supabase.from("drill_holes").select("id, hole_id, easting, northing, elevation, azimuth, dip").eq("project_id", model.project_id);
    if (model.campaign_id) holesQuery.eq("campaign_id", model.campaign_id);
    const { data: holesData, error: hErr } = await holesQuery;
    if (hErr) throw hErr;
    const holes = new Map((holesData ?? []).map((h: Hole) => [h.id, h]));
    if (holes.size === 0) throw new Error("No drill holes found for project/campaign");

    // 3) Fetch core logs
    const holeIds = Array.from(holes.keys());
    const { data: logs, error: lErr } = await supabase
      .from("drill_core_logs")
      .select("hole_id, depth_from, depth_to, au_gpt, ag_gpt, cu_pct")
      .in("hole_id", holeIds);
    if (lErr) throw lErr;

    const commodityCol = getCommodityColumn(model.commodity);
    const composites = compositeIntervals(
      (logs ?? []) as CoreLog[],
      holes,
      commodityCol,
      Number(model.composite_length),
    );
    if (composites.length === 0) {
      await supabase.from("resource_models").update({ status: "failed", notes: "No valid composites" }).eq("id", model_id);
      throw new Error(`No valid composites for commodity ${model.commodity}`);
    }

    // 4) Estimate
    const params: ModelParams = {
      method: model.method,
      search_radius: Number(model.search_radius),
      min_samples: Number(model.min_samples),
      max_samples: Number(model.max_samples),
      power: Number(model.power),
      block_size_x: Number(model.block_size_x),
      block_size_y: Number(model.block_size_y),
      block_size_z: Number(model.block_size_z),
      density_t_m3: Number(model.density_t_m3),
      cutoff_grade: model.cutoff_grade != null ? Number(model.cutoff_grade) : null,
    };
    const { blocks, bbox } = estimateBlocks(composites, params);

    // 5) Persist composites + blocks (clear previous)
    await supabase.from("resource_blocks").delete().eq("model_id", model_id);
    await supabase.from("resource_composites").delete().eq("model_id", model_id);

    // Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < composites.length; i += chunkSize) {
      const chunk = composites.slice(i, i + chunkSize).map((c) => ({
        model_id, project_id: model.project_id,
        hole_id: c.hole_id, hole_code: c.hole_code,
        depth_from: c.depth_from, depth_to: c.depth_to,
        length_m: c.length_m, grade: c.grade,
        x: c.x, y: c.y, z: c.z,
      }));
      const { error } = await supabase.from("resource_composites").insert(chunk);
      if (error) throw error;
    }
    for (let i = 0; i < blocks.length; i += chunkSize) {
      const chunk = blocks.slice(i, i + chunkSize).map((b) => ({
        ...b, model_id, project_id: model.project_id,
      }));
      const { error } = await supabase.from("resource_blocks").insert(chunk);
      if (error) throw error;
    }

    // 6) Compute global metrics
    const blockVolume = params.block_size_x * params.block_size_y * params.block_size_z;
    const blockTonnage = blockVolume * params.density_t_m3;
    const estimated = blocks.filter((b) => b.grade != null);
    const tonnageTotal = estimated.length * blockTonnage;
    const cutoff = params.cutoff_grade ?? 0;
    const aboveCutoff = estimated.filter((b) => (b.grade ?? 0) >= cutoff);
    const tonnageAboveCutoff = aboveCutoff.length * blockTonnage;
    const meanGrade = aboveCutoff.length
      ? aboveCutoff.reduce((a, b) => a + (b.grade ?? 0), 0) / aboveCutoff.length
      : 0;
    // Metal content unit depends on commodity; for au/ag it's grams (g/t * t / 1e6 * 1e6 = g) — keep as commodity-native
    const metalContent = tonnageAboveCutoff * meanGrade;

    await supabase.from("resource_models").update({
      status: "complete",
      bbox_min_x: bbox.minX, bbox_max_x: bbox.maxX,
      bbox_min_y: bbox.minY, bbox_max_y: bbox.maxY,
      bbox_min_z: bbox.minZ, bbox_max_z: bbox.maxZ,
      blocks_total: blocks.length,
      blocks_estimated: estimated.length,
      composites_count: composites.length,
      tonnage_total: tonnageTotal,
      tonnage_above_cutoff: tonnageAboveCutoff,
      mean_grade: meanGrade,
      metal_content: metalContent,
      estimated_at: new Date().toISOString(),
    }).eq("id", model_id);

    return new Response(JSON.stringify({
      ok: true,
      composites: composites.length,
      blocks_total: blocks.length,
      blocks_estimated: estimated.length,
      tonnage_total: tonnageTotal,
      tonnage_above_cutoff: tonnageAboveCutoff,
      mean_grade: meanGrade,
      metal_content: metalContent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
