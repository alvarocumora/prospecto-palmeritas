// EMAG2v3 (NOAA NCEI) magnetic anomaly sampler + local-maximum target detector.
// Free, no API key. ImageServer REST: https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer
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

async function sampleEmag2(bbox: z.infer<typeof BBoxSchema>, gridN: number): Promise<Sample[]> {
  // Use exportImage with f=json + pixelType to get raw values would require LERC decoding.
  // Simpler: use /getSamples with a multipoint geometry.
  const points: [number, number][] = [];
  const dx = (bbox.maxLon - bbox.minLon) / (gridN - 1);
  const dy = (bbox.maxLat - bbox.minLat) / (gridN - 1);
  for (let j = 0; j < gridN; j++) {
    for (let i = 0; i < gridN; i++) {
      points.push([bbox.minLon + i * dx, bbox.minLat + j * dy]);
    }
  }
  const multipoint = {
    points,
    spatialReference: { wkid: 4326 },
  };
  const url = new URL(`${EMAG2_BASE}/getSamples`);
  url.searchParams.set("geometry", JSON.stringify(multipoint));
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

function detectLocalMaxima(samples: Sample[], gridN: number, topK: number): Sample[] {
  // Build 2D grid indexed by [j*gridN + i]; flag a cell as a local max if its |v|
  // strictly exceeds the |v| of its 8 neighbours.
  const grid: (Sample | undefined)[] = new Array(gridN * gridN);
  for (const _s of samples) {
    // re-derive i,j from coordinates by nearest-neighbour search would be costly;
    // assume samples came back in the same order we sent them (ArcGIS preserves order).
  }
  // ArcGIS getSamples preserves multipoint order, so we can index directly:
  for (let k = 0; k < samples.length && k < gridN * gridN; k++) {
    grid[k] = samples[k];
  }
  const peaks: Array<Sample & { score: number }> = [];
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

export const detectMagTargets = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        bbox: BBoxSchema,
        gridN: z.number().int().min(8).max(60).default(28),
        topK: z.number().int().min(1).max(50).default(8),
        persist: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const samples = await sampleEmag2(data.bbox, data.gridN);
    if (samples.length === 0) {
      return { samples: [], targets: [], stats: null, persisted: 0 };
    }
    const vals = samples.map((s) => s.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const peaks = detectLocalMaxima(samples, data.gridN, data.topK);

    let persisted = 0;
    if (data.persist && peaks.length > 0) {
      const rows = peaks.map((p, idx) => ({
        project_id: data.projectId,
        name: `MAG-${String(idx + 1).padStart(2, "0")}`,
        lat: p.lat,
        lon: p.lon,
        mag_nt: p.v,
        rank: idx + 1,
        radius_m: 600,
        source: "EMAG2v3",
        bbox: data.bbox,
        metadata: { gridN: data.gridN, mean, std, detected_at: new Date().toISOString() },
        created_by: userId,
      }));
      // Replace previous EMAG2 targets for this project
      await supabase
        .from("mag_targets")
        .delete()
        .eq("project_id", data.projectId)
        .eq("source", "EMAG2v3");
      const { error } = await supabase.from("mag_targets").insert(rows);
      if (error) {
        console.error("mag_targets insert error", error);
      } else {
        persisted = rows.length;
      }
    }

    return {
      samples,
      targets: peaks,
      stats: { min, max, mean, std, count: samples.length },
      persisted,
    };
  });

export const listMagTargets = createServerFn({ method: "GET" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("mag_targets")
      .select("id,name,lat,lon,mag_nt,rank,radius_m,source,metadata,created_at")
      .eq("project_id", data.projectId)
      .order("rank", { ascending: true });
    if (error) throw new Error(error.message);
    return { targets: rows ?? [] };
  });
