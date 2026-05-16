// Sprint 6.4 — DEM differencing: descarga dos GeoTIFF DSM/DTM, los re-muestrea
// a una grilla común (intersección de bounds, ~256x256 max) y calcula:
//   - cut_volume_m3 (suma de celdas donde after < before)
//   - fill_volume_m3 (suma de celdas donde after > before)
//   - net_volume_m3 = fill - cut
// Persiste el resultado en public.dem_diffs.

import { fromArrayBuffer } from "https://esm.sh/geotiff@2.1.3?target=deno&bundle";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  projectId: string;
  name: string;
  rasterBeforeId: string;
  rasterAfterId: string;
  notes?: string;
}

const MAX_GRID = 256; // capped para no reventar memoria del Worker

async function loadDsm(sb: ReturnType<typeof createClient>, rasterId: string) {
  const { data: row, error } = await sb
    .from("drone_rasters")
    .select("id,name,storage_path,bounds_geojson,pixel_size_m")
    .eq("id", rasterId)
    .single();
  if (error || !row) throw new Error(`raster ${rasterId} not found`);
  if (!row.storage_path) throw new Error(`raster ${row.name} has no storage file`);

  const { data: signed } = await sb.storage
    .from("drone-rasters")
    .createSignedUrl(row.storage_path, 60);
  if (!signed) throw new Error("signed-url failed");

  const res = await fetch(signed.signedUrl);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [minX,minY,maxX,maxY] in image CRS
  const data = (await image.readRasters({ samples: [0] })) as unknown as number[][];
  return { width, height, bbox, raster: data[0] as Float32Array | number[], row };
}

function sample(
  raster: Float32Array | number[],
  width: number,
  height: number,
  fx: number,
  fy: number,
): number | null {
  // fx,fy in [0,1] — nearest neighbour
  const px = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
  const v = raster[py * width + px];
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !isFinite(v)) return null;
  if (v < -1e6 || v > 1e6) return null; // nodata sentinel
  return v;
}

function bboxIntersection(a: number[], b: number[]): number[] | null {
  const minX = Math.max(a[0], b[0]);
  const minY = Math.max(a[1], b[1]);
  const maxX = Math.min(a[2], b[2]);
  const maxY = Math.min(a[3], b[3]);
  if (maxX <= minX || maxY <= minY) return null;
  return [minX, minY, maxX, maxY];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId, name, rasterBeforeId, rasterAfterId, notes } = (await req.json()) as Payload;
    if (!projectId || !rasterBeforeId || !rasterAfterId || !name) throw new Error("Missing fields");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = req.headers.get("x-user-id");
    if (!userId) throw new Error("Missing x-user-id header");

    const [before, after] = await Promise.all([
      loadDsm(sb, rasterBeforeId),
      loadDsm(sb, rasterAfterId),
    ]);

    const inter = bboxIntersection(before.bbox, after.bbox);
    if (!inter) throw new Error("Rasters do not overlap spatially");

    // Build sampling grid over the intersection
    const [minX, minY, maxX, maxY] = inter;
    // Choose grid size based on smaller pixel size, capped at MAX_GRID
    const px = Math.max(before.row.pixel_size_m ?? 1, after.row.pixel_size_m ?? 1, 0.5);
    const widthCells = Math.min(MAX_GRID, Math.max(16, Math.floor((maxX - minX) / px)));
    const heightCells = Math.min(MAX_GRID, Math.max(16, Math.floor((maxY - minY) / px)));
    const cellW = (maxX - minX) / widthCells;
    const cellH = (maxY - minY) / heightCells;
    // Approx cell area in m² assuming CRS in meters (UTM); if EPSG:4326 we'd need a haversine correction.
    // We assume DSM uploads are projected (the standard for photogrammetry).
    const cellAreaM2 = cellW * cellH;

    let fill = 0;
    let cut = 0;
    let cells = 0;
    let dMin = Infinity;
    let dMax = -Infinity;
    let dSum = 0;

    for (let j = 0; j < heightCells; j++) {
      const cy = minY + (j + 0.5) * cellH;
      // For both rasters, compute fx,fy
      const fyB = (cy - before.bbox[1]) / (before.bbox[3] - before.bbox[1]);
      const fyA = (cy - after.bbox[1]) / (after.bbox[3] - after.bbox[1]);
      for (let i = 0; i < widthCells; i++) {
        const cx = minX + (i + 0.5) * cellW;
        const fxB = (cx - before.bbox[0]) / (before.bbox[2] - before.bbox[0]);
        const fxA = (cx - after.bbox[0]) / (after.bbox[2] - after.bbox[0]);
        const vB = sample(before.raster, before.width, before.height, fxB, 1 - fyB);
        const vA = sample(after.raster, after.width, after.height, fxA, 1 - fyA);
        if (vA === null || vB === null) continue;
        const d = vA - vB;
        if (d > 0) fill += d * cellAreaM2;
        else if (d < 0) cut += -d * cellAreaM2;
        if (d < dMin) dMin = d;
        if (d > dMax) dMax = d;
        dSum += d;
        cells++;
      }
    }

    if (cells === 0)
      throw new Error("No overlapping valid cells (rasters may be in different CRS)");

    const result = {
      project_id: projectId,
      name,
      raster_before_id: rasterBeforeId,
      raster_after_id: rasterAfterId,
      bbox_geojson: { bbox: inter },
      pixel_size_m: Math.max(cellW, cellH),
      fill_volume_m3: Math.round(fill * 100) / 100,
      cut_volume_m3: Math.round(cut * 100) / 100,
      net_volume_m3: Math.round((fill - cut) * 100) / 100,
      cells_analyzed: cells,
      diff_min_m: Math.round(dMin * 1000) / 1000,
      diff_max_m: Math.round(dMax * 1000) / 1000,
      diff_mean_m: Math.round((dSum / cells) * 1000) / 1000,
      notes: notes ?? null,
      created_by: userId,
    };

    const { data: row, error: insErr } = await sb
      .from("dem_diffs")
      .insert(result)
      .select()
      .single();
    if (insErr) throw new Error(`insert: ${insErr.message}`);

    return new Response(JSON.stringify({ ok: true, diff: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dem-diff]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
