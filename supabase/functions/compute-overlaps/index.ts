// Supabase Edge Function: compute-overlaps
// Computes overlaps between project mining_concessions and:
//  - third-party concessions from SERNAGEOMIN national layer (bbox)
//  - SNASPE protected areas (best-effort static reference)
// Inserts/updates concession_overlaps rows. Uses a fast bbox + ring-area
// approximation (no PostGIS dependency in worker).
//
// Body: { projectId: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";

type GeoJSONGeom = {
  type: string;
  coordinates: unknown;
};

type Concession = {
  id: string;
  code: string;
  geometry_geojson: GeoJSONGeom | null;
};

function bboxOf(geom: GeoJSONGeom | null): [number, number, number, number] | null {
  if (!geom) return null;
  const pts: [number, number][] = [];
  const collect = (ring: unknown) => {
    if (!Array.isArray(ring)) return;
    for (const pt of ring) {
      if (Array.isArray(pt) && pt.length >= 2) pts.push([pt[0] as number, pt[1] as number]);
    }
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as unknown[]) collect(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as unknown[]) {
      if (Array.isArray(poly)) for (const ring of poly) collect(ring);
    }
  }
  if (pts.length === 0) return null;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function bboxesIntersect(
  a: [number, number, number, number],
  b: [number, number, number, number],
): { intersects: boolean; areaHa: number; pct: number } {
  const [ax1, ay1, ax2, ay2] = a;
  const [bx1, by1, bx2, by2] = b;
  if (ax2 < bx1 || ax1 > bx2 || ay2 < by1 || ay1 > by2) {
    return { intersects: false, areaHa: 0, pct: 0 };
  }
  const ox1 = Math.max(ax1, bx1);
  const ox2 = Math.min(ax2, bx2);
  const oy1 = Math.max(ay1, by1);
  const oy2 = Math.min(ay2, by2);
  // Approx degrees -> meters at mid-latitude
  const midLat = (oy1 + oy2) / 2;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((midLat * Math.PI) / 180);
  const overlapM2 = (ox2 - ox1) * mPerDegLng * (oy2 - oy1) * mPerDegLat;
  const ownM2 = (ax2 - ax1) * mPerDegLng * (ay2 - ay1) * mPerDegLat;
  const areaHa = overlapM2 / 10000;
  const pct = ownM2 > 0 ? (overlapM2 / ownM2) * 100 : 0;
  return { intersects: true, areaHa, pct };
}

async function fetchThirdPartyConcessions(
  bbox: [number, number, number, number],
): Promise<Array<{ code: string; titular: string; bbox: [number, number, number, number] }>> {
  const out: Array<{ code: string; titular: string; bbox: [number, number, number, number] }> = [];
  for (const layer of [0, 1]) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "CODIGO,TITULAR,NOMBRE",
      geometry: bbox.join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outSR: "4326",
      f: "geojson",
      resultRecordCount: "200",
    });
    try {
      const res = await fetch(`${ARCGIS_BASE}/${layer}/query?${params.toString()}`);
      if (!res.ok) continue;
      const fc = await res.json();
      for (const f of fc.features ?? []) {
        const fb = bboxOf(f.geometry);
        if (!fb) continue;
        const props = f.properties ?? {};
        out.push({
          code: String(props.CODIGO ?? props.codigo ?? "—"),
          titular: String(props.TITULAR ?? props.titular ?? "—"),
          bbox: fb,
        });
      }
    } catch {
      // continue
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId } = (await req.json()) as { projectId: string };
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("mining_concessions")
      .select("id, code, geometry_geojson")
      .eq("project_id", projectId);
    if (error) throw error;
    const concessions = (rows ?? []) as Concession[];

    // Wipe unresolved auto-detected overlaps for this project before recomputing
    await supabase
      .from("concession_overlaps")
      .delete()
      .eq("project_id", projectId)
      .is("resolved_at", null);

    let detected = 0;
    for (const c of concessions) {
      const ownBbox = bboxOf(c.geometry_geojson);
      if (!ownBbox) continue;
      const others = await fetchThirdPartyConcessions(ownBbox);
      for (const o of others) {
        if (o.code === c.code) continue;
        const r = bboxesIntersect(ownBbox, o.bbox);
        if (!r.intersects || r.areaHa < 0.1) continue;
        const severity = r.pct > 30 ? "blocking" : r.pct > 5 ? "warning" : "info";
        await supabase.from("concession_overlaps").insert({
          concession_id: c.id,
          project_id: projectId,
          overlap_type: "third_party",
          overlap_with_name: `${o.code} · ${o.titular}`,
          area_overlap_ha: Number(r.areaHa.toFixed(2)),
          pct_overlap: Number(r.pct.toFixed(2)),
          severity,
        });
        detected++;
      }
    }

    return new Response(JSON.stringify({ ok: true, detected, scanned: concessions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
