// Re-validación automática de targets magnéticos contra EMAG2v3.
// Compara la corrida nueva con el snapshot persistido y registra el diff.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCatastroRole } from "@/lib/access/roleMiddleware";

const EMAG2_BASE = "https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer";

const BBoxSchema = z.object({
  minLon: z.number().min(-180).max(180),
  minLat: z.number().min(-90).max(90),
  maxLon: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
});

type Sample = { lon: number; lat: number; v: number };
type Peak = Sample & { score: number };
type ExistingTarget = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  mag_nt: number;
  rank: number;
  bbox: unknown;
};

async function sampleEmag2(bbox: z.infer<typeof BBoxSchema>, gridN: number): Promise<Sample[]> {
  const points: [number, number][] = [];
  const dx = (bbox.maxLon - bbox.minLon) / (gridN - 1);
  const dy = (bbox.maxLat - bbox.minLat) / (gridN - 1);
  for (let j = 0; j < gridN; j++) {
    for (let i = 0; i < gridN; i++) {
      points.push([bbox.minLon + i * dx, bbox.minLat + j * dy]);
    }
  }
  const url = new URL(`${EMAG2_BASE}/getSamples`);
  url.searchParams.set("geometry", JSON.stringify({ points, spatialReference: { wkid: 4326 } }));
  url.searchParams.set("geometryType", "esriGeometryMultipoint");
  url.searchParams.set("returnFirstValueOnly", "true");
  url.searchParams.set("interpolation", "RSP_BilinearInterpolation");
  url.searchParams.set("f", "json");
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`EMAG2 getSamples ${res.status}`);
  const data = (await res.json()) as {
    samples?: Array<{ location: { x: number; y: number }; value: string }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`EMAG2: ${data.error.message ?? "unknown"}`);
  return (data.samples ?? [])
    .map((s) => ({
      lon: s.location.x,
      lat: s.location.y,
      v: parseFloat(s.value),
    }))
    .filter((s) => Number.isFinite(s.v));
}

function detectLocalMaxima(samples: Sample[], gridN: number, topK: number): Peak[] {
  const grid: (Sample | undefined)[] = new Array(gridN * gridN);
  for (let k = 0; k < samples.length && k < gridN * gridN; k++) grid[k] = samples[k];
  const peaks: Peak[] = [];
  for (let j = 1; j < gridN - 1; j++) {
    for (let i = 1; i < gridN - 1; i++) {
      const c = grid[j * gridN + i];
      if (!c) continue;
      const a = Math.abs(c.v);
      let isMax = true;
      for (let dj = -1; dj <= 1 && isMax; dj++) {
        for (let di = -1; di <= 1 && isMax; di++) {
          if (di === 0 && dj === 0) continue;
          const n = grid[(j + dj) * gridN + (i + di)];
          if (n && Math.abs(n.v) >= a) isMax = false;
        }
      }
      if (isMax) peaks.push({ ...c, score: a });
    }
  }
  peaks.sort((p, q) => q.score - p.score);
  return peaks.slice(0, topK);
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type DiffRow = {
  change_type: "added" | "removed" | "moved" | "mag_changed" | "unchanged";
  name: string | null;
  prev_rank: number | null;
  new_rank: number | null;
  prev_lat: number | null;
  prev_lon: number | null;
  new_lat: number | null;
  new_lon: number | null;
  prev_mag_nt: number | null;
  new_mag_nt: number | null;
  shift_m: number | null;
  mag_delta_nt: number | null;
  rank_delta: number | null;
};

// Greedy pairing: match each new peak to the nearest unused previous target
// within MATCH_RADIUS_M; the rest become added/removed.
const MATCH_RADIUS_M = 1500;
const MOVED_THRESHOLD_M = 200;
const MAG_CHANGED_THRESHOLD_NT = 5;

function buildDiff(prev: ExistingTarget[], next: Peak[]): DiffRow[] {
  const used = new Set<number>();
  const rows: DiffRow[] = [];
  next.forEach((p, idx) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    prev.forEach((t, i) => {
      if (used.has(i)) return;
      const d = haversineM(p.lat, p.lon, t.lat, t.lon);
      if (d < bestDist && d <= MATCH_RADIUS_M) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const newRank = idx + 1;
    if (bestIdx >= 0) {
      used.add(bestIdx);
      const t = prev[bestIdx];
      const magDelta = p.v - t.mag_nt;
      const rankDelta = newRank - t.rank;
      const moved = bestDist >= MOVED_THRESHOLD_M;
      const magChanged = Math.abs(magDelta) >= MAG_CHANGED_THRESHOLD_NT;
      const change_type: DiffRow["change_type"] = moved
        ? "moved"
        : magChanged
          ? "mag_changed"
          : "unchanged";
      rows.push({
        change_type,
        name: t.name,
        prev_rank: t.rank,
        new_rank: newRank,
        prev_lat: t.lat,
        prev_lon: t.lon,
        new_lat: p.lat,
        new_lon: p.lon,
        prev_mag_nt: t.mag_nt,
        new_mag_nt: p.v,
        shift_m: bestDist,
        mag_delta_nt: magDelta,
        rank_delta: rankDelta,
      });
    } else {
      rows.push({
        change_type: "added",
        name: `MAG-${String(newRank).padStart(2, "0")}`,
        prev_rank: null,
        new_rank: newRank,
        prev_lat: null,
        prev_lon: null,
        new_lat: p.lat,
        new_lon: p.lon,
        prev_mag_nt: null,
        new_mag_nt: p.v,
        shift_m: null,
        mag_delta_nt: null,
        rank_delta: null,
      });
    }
  });
  prev.forEach((t, i) => {
    if (used.has(i)) return;
    rows.push({
      change_type: "removed",
      name: t.name,
      prev_rank: t.rank,
      new_rank: null,
      prev_lat: t.lat,
      prev_lon: t.lon,
      new_lat: null,
      new_lon: null,
      prev_mag_nt: t.mag_nt,
      new_mag_nt: null,
      shift_m: null,
      mag_delta_nt: null,
      rank_delta: null,
    });
  });
  return rows;
}

export const revalidateMagTargets = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        bbox: BBoxSchema.optional(),
        gridN: z.number().int().min(8).max(60).default(28),
        topK: z.number().int().min(1).max(50).default(10),
        triggeredBy: z.enum(["manual", "cron", "api"]).default("manual"),
        persistNew: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load previous EMAG2v3 targets
    const { data: prevRows, error: prevErr } = await supabase
      .from("mag_targets")
      .select("id,name,lat,lon,mag_nt,rank,bbox")
      .eq("project_id", data.projectId)
      .eq("source", "EMAG2v3")
      .order("rank", { ascending: true });
    if (prevErr) throw new Error(prevErr.message);
    const prev: ExistingTarget[] = (prevRows ?? []) as ExistingTarget[];

    // Resolve bbox: prefer explicit input, else infer from previous run
    let bbox = data.bbox;
    if (!bbox && prev.length > 0 && prev[0].bbox) {
      const candidate = prev[0].bbox as z.infer<typeof BBoxSchema>;
      const parsed = BBoxSchema.safeParse(candidate);
      if (parsed.success) bbox = parsed.data;
    }
    if (!bbox) {
      throw new Error("bbox required: no previous run with stored bbox");
    }

    const samples = await sampleEmag2(bbox, data.gridN);
    const peaks = detectLocalMaxima(samples, data.gridN, data.topK);

    const diffRows = buildDiff(prev, peaks);
    const moved = diffRows.filter((r) => r.change_type === "moved");
    const magChanged = diffRows.filter((r) => r.change_type === "mag_changed");
    const added = diffRows.filter((r) => r.change_type === "added");
    const removed = diffRows.filter((r) => r.change_type === "removed");
    const unchanged = diffRows.filter((r) => r.change_type === "unchanged");

    const matched = diffRows.filter((r) => r.shift_m != null);
    const shifts = matched.map((r) => r.shift_m as number);
    const magDeltas = diffRows
      .filter((r) => r.mag_delta_nt != null)
      .map((r) => Math.abs(r.mag_delta_nt as number));
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : null);

    const vals = samples.map((s) => s.v);
    const stats =
      vals.length > 0
        ? {
            min: Math.min(...vals),
            max: Math.max(...vals),
            mean: vals.reduce((a, b) => a + b, 0) / vals.length,
            count: vals.length,
          }
        : null;

    // Insert revalidation run
    const { data: runRow, error: runErr } = await supabase
      .from("mag_target_revalidations")
      .insert({
        project_id: data.projectId,
        bbox,
        grid_n: data.gridN,
        top_k: data.topK,
        prev_count: prev.length,
        new_count: peaks.length,
        added_count: added.length,
        removed_count: removed.length,
        moved_count: moved.length,
        mag_changed_count: magChanged.length,
        unchanged_count: unchanged.length,
        mean_shift_m: mean(shifts),
        max_shift_m: maxOf(shifts),
        mean_mag_delta_nt: mean(magDeltas),
        max_mag_delta_nt: maxOf(magDeltas),
        stats,
        prev_snapshot: JSON.parse(JSON.stringify(prev)),
        new_snapshot: JSON.parse(JSON.stringify(peaks)),
        triggered_by: data.triggeredBy,
        created_by: userId,
      })
      .select("id")
      .single();
    if (runErr || !runRow) {
      throw new Error(runErr?.message ?? "failed to insert revalidation run");
    }

    // Insert diff rows
    if (diffRows.length > 0) {
      const payload = diffRows.map((r) => ({
        revalidation_id: runRow.id,
        project_id: data.projectId,
        ...r,
      }));
      const { error: diffErr } = await supabase
        .from("mag_target_revalidation_diffs")
        .insert(payload);
      if (diffErr) console.error("diff insert error", diffErr);
    }

    // Optionally replace persisted targets with new run
    if (data.persistNew && peaks.length > 0) {
      await supabase
        .from("mag_targets")
        .delete()
        .eq("project_id", data.projectId)
        .eq("source", "EMAG2v3");
      const newRows = peaks.map((p, idx) => ({
        project_id: data.projectId,
        name: `MAG-${String(idx + 1).padStart(2, "0")}`,
        lat: p.lat,
        lon: p.lon,
        mag_nt: p.v,
        rank: idx + 1,
        radius_m: 600,
        source: "EMAG2v3",
        bbox,
        metadata: {
          gridN: data.gridN,
          revalidation_id: runRow.id,
          revalidated_at: new Date().toISOString(),
        },
        created_by: userId,
      }));
      await supabase.from("mag_targets").insert(newRows);
    }

    return {
      revalidationId: runRow.id,
      summary: {
        prev: prev.length,
        next: peaks.length,
        added: added.length,
        removed: removed.length,
        moved: moved.length,
        magChanged: magChanged.length,
        unchanged: unchanged.length,
        meanShiftM: mean(shifts),
        maxShiftM: maxOf(shifts),
        meanMagDeltaNt: mean(magDeltas),
        maxMagDeltaNt: maxOf(magDeltas),
      },
      diffs: diffRows,
    };
  });

export const listMagRevalidations = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("mag_target_revalidations")
      .select(
        "id,created_at,triggered_by,prev_count,new_count,added_count,removed_count,moved_count,mag_changed_count,unchanged_count,mean_shift_m,max_shift_m,mean_mag_delta_nt,max_mag_delta_nt,grid_n,top_k",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { runs: rows ?? [] };
  });

export const getMagRevalidationDiffs = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => z.object({ revalidationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("mag_target_revalidation_diffs")
      .select("*")
      .eq("revalidation_id", data.revalidationId)
      .order("change_type", { ascending: true });
    if (error) throw new Error(error.message);
    return { diffs: rows ?? [] };
  });
