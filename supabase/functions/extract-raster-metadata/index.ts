// Sprint 6.2 — Lee la cabecera de un GeoTIFF subido a Storage y devuelve su metadata
// (CRS, bounds en lat/lng, tamaño, bandas, min/max). Si no es GeoTIFF (PNG/JPG) devuelve solo size.
// Usa la lib `geotiff` desde esm.sh. NO descarga el archivo completo si supera 30 MB:
// usa un Range request para leer solo los primeros bytes (la cabecera GeoTIFF cabe en <1 MB típicamente).

import { fromArrayBuffer } from "https://esm.sh/geotiff@2.1.3?target=deno&bundle";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  rasterId: string;
  bucket: string;
  path: string;
}

// EPSG → human-readable CRS
function crsLabel(epsg: number | null): string {
  if (!epsg) return "unknown";
  if (epsg === 4326) return "EPSG:4326 (WGS84)";
  if (epsg === 3857) return "EPSG:3857 (Web Mercator)";
  if (epsg >= 32601 && epsg <= 32660) return `EPSG:${epsg} (UTM ${epsg - 32600}N WGS84)`;
  if (epsg >= 32701 && epsg <= 32760) return `EPSG:${epsg} (UTM ${epsg - 32700}S WGS84)`;
  return `EPSG:${epsg}`;
}

// Naive UTM → lat/lng (only works when EPSG is UTM WGS84, sufficient for Chilean projects)
function utmToLatLng(
  easting: number,
  northing: number,
  zone: number,
  southern: boolean,
): [number, number] {
  const a = 6378137;
  const e = 0.081819191;
  const k0 = 0.9996;
  const e1sq = 0.006739497;
  const x = easting - 500000;
  const y = southern ? northing - 10000000 : northing;
  const M = y / k0;
  const mu =
    M / (a * (1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256));
  const phi1 =
    mu +
    ((3 * e1sq) / 2 - (27 * Math.pow(e1sq, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * Math.pow(e1sq, 2)) / 16 - (55 * Math.pow(e1sq, 4)) / 32) * Math.sin(4 * mu);
  const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(phi1), 2));
  const T1 = Math.pow(Math.tan(phi1), 2);
  const C1 = e1sq * Math.pow(Math.cos(phi1), 2);
  const R1 =
    (a * (1 - Math.pow(e, 2))) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(phi1), 2), 1.5);
  const D = x / (N1 * k0);
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (Math.pow(D, 2) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e1sq) * Math.pow(D, 4)) / 24);
  const lng =
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e1sq + 24 * Math.pow(T1, 2)) *
        Math.pow(D, 5)) /
        120) /
    Math.cos(phi1);
  const lon = (lng * 180) / Math.PI + (zone * 6 - 183);
  return [(lat * 180) / Math.PI, lon];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { rasterId, bucket, path } = (await req.json()) as Payload;
    if (!rasterId || !bucket || !path) throw new Error("Missing rasterId/bucket/path");

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, serviceKey);

    // 1. Get a signed URL we can range-fetch
    const { data: signed, error: signErr } = await sb.storage
      .from(bucket)
      .createSignedUrl(path, 60);
    if (signErr || !signed) throw new Error(`signed-url: ${signErr?.message}`);

    // 2. Get total size via HEAD
    const head = await fetch(signed.signedUrl, { method: "HEAD" });
    const totalSize = Number(head.headers.get("content-length") ?? 0);
    const contentType = head.headers.get("content-type") ?? "";

    // 3. Decide download strategy: full file if <8 MB, else first 4 MB only (enough for GeoTIFF header + IFD)
    const isLikelyTiff =
      path.toLowerCase().match(/\.(tif|tiff|geotiff)$/) || contentType.includes("tiff");
    const maxRead = totalSize > 8 * 1024 * 1024 ? 4 * 1024 * 1024 : totalSize;
    const dlRes = await fetch(signed.signedUrl, {
      headers: maxRead < totalSize ? { Range: `bytes=0-${maxRead - 1}` } : {},
    });
    if (!dlRes.ok && dlRes.status !== 206) throw new Error(`download: HTTP ${dlRes.status}`);
    const buf = await dlRes.arrayBuffer();

    type Meta = {
      crs: string | null;
      pixel_size_m: number | null;
      width_px: number | null;
      height_px: number | null;
      band_count: number | null;
      min_value: number | null;
      max_value: number | null;
      file_size_bytes: number;
      bounds_geojson: { bbox: [number, number, number, number] } | null;
    };

    let meta: Meta = {
      crs: null,
      pixel_size_m: null,
      width_px: null,
      height_px: null,
      band_count: null,
      min_value: null,
      max_value: null,
      file_size_bytes: totalSize,
      bounds_geojson: null,
    };

    if (isLikelyTiff) {
      try {
        const tiff = await fromArrayBuffer(buf);
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        const bands = image.getSamplesPerPixel();
        const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY] in image CRS
        const resolution = image.getResolution();
        const geoKeys = image.getGeoKeys() ?? {};
        const epsg: number | null =
          geoKeys.ProjectedCSTypeGeoKey ?? geoKeys.GeographicTypeGeoKey ?? null;

        let bboxLngLat: [number, number, number, number] | null = null;
        if (epsg === 4326) {
          bboxLngLat = [bbox[0], bbox[1], bbox[2], bbox[3]];
        } else if (epsg && ((epsg >= 32601 && epsg <= 32660) || (epsg >= 32701 && epsg <= 32760))) {
          const south = epsg >= 32701;
          const zone = south ? epsg - 32700 : epsg - 32600;
          const sw = utmToLatLng(bbox[0], bbox[1], zone, south);
          const ne = utmToLatLng(bbox[2], bbox[3], zone, south);
          bboxLngLat = [sw[1], sw[0], ne[1], ne[0]];
        }

        meta = {
          ...meta,
          crs: crsLabel(epsg),
          pixel_size_m: resolution[0] ? Math.abs(resolution[0]) : null,
          width_px: width,
          height_px: height,
          band_count: bands,
          bounds_geojson: bboxLngLat ? { bbox: bboxLngLat } : null,
        };
      } catch (tiffErr) {
        console.warn("[extract-raster-metadata] geotiff parse failed:", tiffErr);
      }
    }

    // 4. Persist
    const { error: updErr } = await sb
      .from("drone_rasters")
      .update({
        crs: meta.crs,
        pixel_size_m: meta.pixel_size_m,
        width_px: meta.width_px,
        height_px: meta.height_px,
        band_count: meta.band_count,
        min_value: meta.min_value,
        max_value: meta.max_value,
        file_size_bytes: meta.file_size_bytes,
        bounds_geojson: meta.bounds_geojson ?? undefined,
        processing: false,
      })
      .eq("id", rasterId);
    if (updErr) throw new Error(`update: ${updErr.message}`);

    return new Response(JSON.stringify({ ok: true, meta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-raster-metadata error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
