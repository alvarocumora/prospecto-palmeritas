// Sprint 6.5 — Stockpile volume: dado un raster DSM y un polígono GeoJSON
// (en lat/lng), calcula el volumen sobre un plano base.
// base_method:
//   - "edge_mean": promedio de los píxeles del contorno del polígono
//   - "min": elevación mínima dentro del polígono
//   - "fixed": usa base_elevation_m provisto por el usuario
// Asume DSM proyectado en metros (UTM) — convertimos polígono lat/lng → UTM zone del raster.

import { fromArrayBuffer } from "https://esm.sh/geotiff@2.1.3?target=deno&bundle";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { requireUser, requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  projectId: string;
  rasterId: string;
  name: string;
  material?: string | null;
  polygonGeojson: GeoJSON.Polygon; // ring[0] in [lng,lat]
  baseMethod: "edge_mean" | "min" | "fixed";
  baseElevationM?: number | null;
  notes?: string | null;
}

const MAX_GRID = 256;

// Naive lat/lng → UTM (WGS84). Returns [easting, northing, zone, southern].
function latLngToUtm(lat: number, lng: number): [number, number, number, boolean] {
  const a = 6378137;
  const e = 0.081819191;
  const k0 = 0.9996;
  const zone = Math.floor((lng + 180) / 6) + 1;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;
  const N = a / Math.sqrt(1 - Math.pow(e * Math.sin(latRad), 2));
  const T = Math.pow(Math.tan(latRad), 2);
  const C = (e * e * Math.pow(Math.cos(latRad), 2)) / (1 - e * e);
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);
  const M =
    a *
    ((1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256) * latRad -
      ((3 * Math.pow(e, 2)) / 8 + (3 * Math.pow(e, 4)) / 32 + (45 * Math.pow(e, 6)) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * Math.pow(e, 4)) / 256 + (45 * Math.pow(e, 6)) / 1024) * Math.sin(4 * latRad) -
      ((35 * Math.pow(e, 6)) / 3072) * Math.sin(6 * latRad));
  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + Math.pow(T, 2) + 72 * C - (58 * (e * e)) / (1 - e * e)) * Math.pow(A, 5)) /
          120) +
    500000;
  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        (Math.pow(A, 2) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + Math.pow(T, 2) + 600 * C - (330 * (e * e)) / (1 - e * e)) *
            Math.pow(A, 6)) /
            720));
  const southern = lat < 0;
  if (southern) northing += 10000000;
  return [easting, northing, zone, southern];
}

function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function sample(
  raster: Float32Array | number[],
  width: number,
  height: number,
  fx: number,
  fy: number,
): number | null {
  const px = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
  const py = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
  const v = raster[py * width + px];
  if (typeof v !== "number" || !isFinite(v) || v < -1e6 || v > 1e6) return null;
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    const { projectId, rasterId, name, polygonGeojson, baseMethod } = body;
    if (!projectId || !rasterId || !name || !polygonGeojson) throw new Error("Missing fields");

    const authRes = await requireUser(req);
    if ("error" in authRes) return authRes.error;
    const userId = authRes.userId;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const memRes = await requireProjectMember(sb, userId, projectId);
    if ("error" in memRes) return memRes.error;

    const { data: row, error } = await sb
      .from("drone_rasters")
      .select("id,name,storage_path,pixel_size_m,crs")
      .eq("id", rasterId)
      .single();
    if (error || !row) throw new Error("raster not found");
    if (!row.storage_path) throw new Error("raster has no storage file");

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
    const bbox = image.getBoundingBox(); // raster CRS
    const data = (await image.readRasters({ samples: [0] })) as unknown as (
      Float32Array | number[]
    )[];
    const raster = data[0];

    // Convert polygon (lng,lat) → raster CRS (assume UTM)
    const ringLL = polygonGeojson.coordinates[0];
    const ringRC: number[][] = ringLL.map(([lng, lat]) => {
      const [e, n] = latLngToUtm(lat, lng);
      return [e, n];
    });
    // Polygon bounds in raster CRS
    let pMinX = Infinity,
      pMinY = Infinity,
      pMaxX = -Infinity,
      pMaxY = -Infinity;
    for (const [x, y] of ringRC) {
      if (x < pMinX) pMinX = x;
      if (x > pMaxX) pMaxX = x;
      if (y < pMinY) pMinY = y;
      if (y > pMaxY) pMaxY = y;
    }
    // Clip to raster bbox
    const clipMinX = Math.max(pMinX, bbox[0]);
    const clipMinY = Math.max(pMinY, bbox[1]);
    const clipMaxX = Math.min(pMaxX, bbox[2]);
    const clipMaxY = Math.min(pMaxY, bbox[3]);
    if (clipMaxX <= clipMinX || clipMaxY <= clipMinY) {
      throw new Error("Polygon does not overlap raster");
    }

    const px = Math.max(row.pixel_size_m ?? 1, 0.25);
    const wCells = Math.min(MAX_GRID, Math.max(16, Math.floor((clipMaxX - clipMinX) / px)));
    const hCells = Math.min(MAX_GRID, Math.max(16, Math.floor((clipMaxY - clipMinY) / px)));
    const cellW = (clipMaxX - clipMinX) / wCells;
    const cellH = (clipMaxY - clipMinY) / hCells;
    const cellArea = cellW * cellH;

    // First pass: collect inside-cells & edge-cells
    const inside: { x: number; y: number; v: number }[] = [];
    const edgeVals: number[] = [];

    for (let j = 0; j < hCells; j++) {
      const cy = clipMinY + (j + 0.5) * cellH;
      const fy = (cy - bbox[1]) / (bbox[3] - bbox[1]);
      for (let i = 0; i < wCells; i++) {
        const cx = clipMinX + (i + 0.5) * cellW;
        if (!pointInPolygon(cx, cy, ringRC)) continue;
        const fx = (cx - bbox[0]) / (bbox[2] - bbox[0]);
        const v = sample(raster, width, height, fx, 1 - fy);
        if (v === null) continue;
        inside.push({ x: cx, y: cy, v });
        // Edge detection: cell adjacent to outside or to polygon boundary
        const onEdge =
          i === 0 ||
          j === 0 ||
          i === wCells - 1 ||
          j === hCells - 1 ||
          !pointInPolygon(cx + cellW, cy, ringRC) ||
          !pointInPolygon(cx - cellW, cy, ringRC) ||
          !pointInPolygon(cx, cy + cellH, ringRC) ||
          !pointInPolygon(cx, cy - cellH, ringRC);
        if (onEdge) edgeVals.push(v);
      }
    }

    if (inside.length === 0) throw new Error("No valid DSM cells inside polygon");

    let baseZ: number;
    if (baseMethod === "fixed") {
      if (body.baseElevationM === null || body.baseElevationM === undefined)
        throw new Error("base_elevation_m required for fixed method");
      baseZ = body.baseElevationM;
    } else if (baseMethod === "min") {
      baseZ = Math.min(...inside.map((c) => c.v));
    } else {
      // edge_mean
      const src = edgeVals.length > 0 ? edgeVals : inside.map((c) => c.v);
      baseZ = src.reduce((a, b) => a + b, 0) / src.length;
    }

    let volume = 0;
    let maxH = 0;
    let sumH = 0;
    let validCells = 0;
    for (const c of inside) {
      const h = c.v - baseZ;
      if (h > 0) {
        volume += h * cellArea;
        sumH += h;
        if (h > maxH) maxH = h;
        validCells++;
      }
    }
    const areaM2 = inside.length * cellArea;
    const meanH = validCells > 0 ? sumH / validCells : 0;

    const result = {
      project_id: projectId,
      raster_id: rasterId,
      name,
      material: body.material ?? null,
      polygon_geojson: polygonGeojson,
      base_method: baseMethod,
      base_elevation_m: Math.round(baseZ * 100) / 100,
      volume_m3: Math.round(volume * 100) / 100,
      area_m2: Math.round(areaM2 * 100) / 100,
      mean_height_m: Math.round(meanH * 100) / 100,
      max_height_m: Math.round(maxH * 100) / 100,
      cells_analyzed: inside.length,
      pixel_size_m: Math.max(cellW, cellH),
      notes: body.notes ?? null,
      created_by: userId,
    };

    const { data: stored, error: insErr } = await sb
      .from("stockpile_volumes")
      .insert(result)
      .select()
      .single();
    if (insErr) throw new Error(`insert: ${insErr.message}`);

    return new Response(JSON.stringify({ ok: true, stockpile: stored }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stockpile-volume]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
