// Edge Function: import-concession
// Looks up a concession by CODE/ROL in SERNAGEOMIN ArcGIS and inserts it
// (with real geometry, holder, area, vigencia) into mining_concessions.
//
// Body: { projectId: string, codes: string[] }
// Returns: { imported, skipped, failed, results: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";
const LAYERS = [0, 1]; // 0 = Explotación, 1 = Exploración (typical SERNAGEOMIN layout)

type ArcgisFeature = {
  attributes: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
};

async function queryArcgis(
  code: string,
): Promise<{ feature: ArcgisFeature; layer: number } | null> {
  const safe = code.replace(/'/g, "''");
  for (const layer of LAYERS) {
    const params = new URLSearchParams({
      where: `CODIGO='${safe}' OR ROL='${safe}' OR COD_EXPED='${safe}'`,
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: "1",
    });
    try {
      const res = await fetch(`${ARCGIS_BASE}/${layer}/query?${params.toString()}`);
      if (!res.ok) continue;
      const json = await res.json();
      const f = json?.features?.[0];
      if (f?.attributes) return { feature: f as ArcgisFeature, layer };
    } catch {
      // try next layer
    }
  }
  return null;
}

function ringsToGeoJson(rings?: number[][][]): unknown | null {
  if (!rings || !Array.isArray(rings) || rings.length === 0) return null;
  if (rings.length === 1) {
    return { type: "Polygon", coordinates: rings };
  }
  // Multiple rings → MultiPolygon (each as its own polygon, simplification)
  return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
}

function pickAttr(attrs: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = attrs[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function pickNum(attrs: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = attrs[k];
    if (v !== null && v !== undefined && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function parseDate(attrs: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = attrs[k];
    if (v === null || v === undefined || v === "") continue;
    // ArcGIS dates are often epoch ms
    if (typeof v === "number") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function mapType(layer: number, attrs: Record<string, unknown>): string {
  const tipo = pickAttr(attrs, ["TIPO", "TIPO_CONCE", "TIPOCONCES"])?.toLowerCase() ?? "";
  if (tipo.includes("explot")) return "explotacion";
  if (tipo.includes("explor")) return "exploracion";
  if (tipo.includes("perten")) return "pertenencia";
  if (tipo.includes("manif")) return "manifestacion";
  // Fallback by layer index
  return layer === 0 ? "explotacion" : "exploracion";
}

function mapStatus(attrs: Record<string, unknown>): string {
  const s = pickAttr(attrs, ["VIGENCIA", "ESTADO", "SITUACION"])?.toLowerCase() ?? "";
  if (s.includes("vig")) return "vigente";
  if (s.includes("tram")) return "en_tramite";
  if (s.includes("venc") || s.includes("cadu")) return "vencida";
  if (s.includes("cancel")) return "cancelada";
  return "vigente";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { projectId, codes } = (await req.json()) as { projectId: string; codes: string[] };
    if (!projectId || !Array.isArray(codes) || codes.length === 0) {
      return new Response(JSON.stringify({ error: "projectId and codes[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller's JWT → user_id for created_by
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const memRes = await requireProjectMember(supabase, user.id, projectId);
    if ("error" in memRes) return memRes.error;

    type Result = {
      code: string;
      status: "imported" | "skipped" | "failed" | "not_found";
      message?: string;
      id?: string;
    };
    const results: Result[] = [];
    let imported = 0,
      skipped = 0,
      failed = 0,
      notFound = 0;

    for (const rawCode of codes) {
      const code = String(rawCode).trim();
      if (!code) continue;

      // Skip if already exists for this project
      const { data: existing } = await supabase
        .from("mining_concessions")
        .select("id")
        .eq("project_id", projectId)
        .eq("code", code)
        .maybeSingle();
      if (existing) {
        skipped++;
        results.push({
          code,
          status: "skipped",
          message: "Ya existe en el proyecto",
          id: existing.id,
        });
        continue;
      }

      const found = await queryArcgis(code);
      if (!found) {
        notFound++;
        results.push({ code, status: "not_found", message: "No encontrado en SERNAGEOMIN" });
        continue;
      }

      const { feature, layer } = found;
      const attrs = feature.attributes;
      const geom = ringsToGeoJson(feature.geometry?.rings);

      const insertRow = {
        project_id: projectId,
        created_by: user.id,
        code,
        name: pickAttr(attrs, ["NOMBRE", "NOM_PERT", "NOM_CONCES"]) ?? code,
        concession_type: mapType(layer, attrs),
        status: mapStatus(attrs),
        holder: pickAttr(attrs, ["TITULAR", "NOMBRE_TIT", "NOM_TITULA"]),
        area_ha: pickNum(attrs, ["AREA_HA", "HECTAREAS", "SUPERFICIE", "SUP_HA"]),
        granted_at: parseDate(attrs, ["FEC_INSC", "FECHA_INSC", "FECHA_OTORG", "FEC_OTORG"]),
        expires_at: parseDate(attrs, ["FEC_VENC", "FECHA_VENC", "VENCIMIENTO", "FEC_CADUC"]),
        region: pickAttr(attrs, ["REGION", "NOM_REGION"]),
        commune: pickAttr(attrs, ["COMUNA", "NOM_COMUNA"]),
        geometry_geojson: geom,
        notes: null,
        source: "sernageomin",
        last_synced_at: new Date().toISOString(),
      };

      const { data: inserted, error: insErr } = await supabase
        .from("mining_concessions")
        .insert(insertRow)
        .select("id")
        .single();

      if (insErr) {
        failed++;
        results.push({ code, status: "failed", message: insErr.message });
        continue;
      }

      // Snapshot in concession_history
      await supabase.from("concession_history").insert({
        concession_id: inserted.id,
        project_id: projectId,
        snapshot: attrs as unknown as Record<string, unknown>,
        diff: null,
        source: "sernageomin",
      });

      imported++;
      results.push({ code, status: "imported", id: inserted.id });
    }

    return new Response(
      JSON.stringify({ ok: true, imported, skipped, failed, notFound, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
