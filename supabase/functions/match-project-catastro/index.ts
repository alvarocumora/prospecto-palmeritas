// Edge Function: match-project-catastro (v2 — SERNAGEOMIN ArcGIS Online)
//
// Descarga TODOS los polígonos del FeatureServer v2 dentro del bounding box
// del proyecto, los persiste en `cadastre_national` y enlaza por similitud
// de nombre cada `mining_concessions` del proyecto a su polígono oficial.
//
// Body: { projectId: string, radiusKm?: number, dryRun?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { queryConcessions, type CanonicalConcession } from "../_shared/sernageomin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/_.]+/g, " ")
    .replace(/\b\d+\s*[-]\s*\d+(\s*[-]\s*\d+)?\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 1));
  const tb = new Set(b.split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const projectId = String((body as { projectId?: string }).projectId ?? "").trim();
    const radiusKm = Number((body as { radiusKm?: number }).radiusKm ?? 15);
    const dryRun = Boolean((body as { dryRun?: boolean }).dryRun ?? false);
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

    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select("id, name, center_lat, center_lng")
      .eq("id", projectId)
      .single();
    if (pErr || !proj) throw new Error(pErr?.message ?? "project not found");
    const lat = Number(proj.center_lat);
    const lng = Number(proj.center_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("project has no center_lat/center_lng");
    }

    const { data: localRows } = await supabase
      .from("mining_concessions")
      .select("id, code, name, holder, area_ha, geometry_geojson")
      .eq("project_id", projectId);
    const local = localRows ?? [];

    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const xmin = lng - dLng;
    const xmax = lng + dLng;
    const ymin = lat - dLat;
    const ymax = lat + dLat;

    const remote = await queryConcessions({
      bbox: { xmin, ymin, xmax, ymax },
      returnGeometry: true,
    });

    // 4) Persiste en cadastre_national (idempotente via upsert_cadastre_feature)
    let upserted = 0;
    for (const c of remote) {
      const externalId =
        c.id_concesion != null ? String(c.id_concesion) : (c.rol ?? crypto.randomUUID());
      const origen = c.tipo === "explotacion" ? "EXPLOTACION" : "EXPLORACION";
      const payload = {
        rol: c.rol,
        name: c.name,
        tipo: c.tipo,
        status: c.status,
        area_ha: c.hectareas,
        region: null,
        commune: c.comuna,
        provincia: null,
        holder_name: c.holder_name,
        holder_rut: c.holder_rut,
        constituted_at: null,
        last_patent_year: c.ano_inscripcion,
        datum: c.datum ?? "WGS84",
        metadata: {
          source_version: "sngm-v2",
          id_concesion: c.id_concesion,
          tipo_raw: c.tipo_raw,
          status_raw: c.status_raw,
          nro_inscripcion: c.nro_inscripcion,
          fojas: c.fojas,
          ano_inscripcion: c.ano_inscripcion,
          origen: c.origen,
          huso: c.huso,
          fecha_vencimiento: c.fecha_vencimiento,
          fecha_actualizacion: c.fecha_actualizacion,
          holder_division: c.holder_division,
        },
      };
      if (!dryRun) {
        const { error: upErr } = await supabase.rpc("upsert_cadastre_feature", {
          _origen: origen,
          _external_id: externalId,
          _payload: payload,
          _geometry_geojson: c.geometry,
        });
        if (!upErr) upserted++;
      } else {
        upserted++;
      }
    }

    type MatchResult = {
      local_code: string;
      local_name: string;
      matched: boolean;
      matched_rol?: string | null;
      matched_name?: string | null;
      score?: number;
      reason?: string;
    };
    const results: MatchResult[] = [];

    const candidates = remote
      .filter((c) => c.name)
      .map((c) => ({ ...c, norm: normalizeName(c.name!) }));

    let matchedCount = 0;
    for (const l of local) {
      const target = normalizeName(String(l.name ?? ""));
      if (!target) {
        results.push({
          local_code: String(l.code),
          local_name: String(l.name),
          matched: false,
          reason: "local sin nombre",
        });
        continue;
      }
      let best: { c: (typeof candidates)[number] & { norm: string }; score: number } | null = null;
      for (const c of candidates) {
        const score = tokenJaccard(target, c.norm);
        if (best == null || score > best.score) best = { c, score };
      }
      if (best && best.score >= 0.5 && best.c.geometry) {
        matchedCount++;
        if (!dryRun) {
          const update: Record<string, unknown> = {
            geometry_geojson: best.c.geometry,
            source: "sernageomin",
            datum: best.c.datum ?? "WGS84",
            last_synced_at: new Date().toISOString(),
          };
          if (best.c.hectareas != null) update.area_ha = best.c.hectareas;
          if (best.c.rol) update.external_id = best.c.rol;
          if (best.c.holder_name) update.holder = best.c.holder_name;
          if (best.c.holder_rut) update.rut_holder = best.c.holder_rut;
          if (best.c.comuna) update.commune = best.c.comuna;
          if (best.c.status) update.status = best.c.status;
          if (best.c.fecha_vencimiento) update.expires_at = best.c.fecha_vencimiento;
          await supabase.from("mining_concessions").update(update).eq("id", l.id);
        }
        results.push({
          local_code: String(l.code),
          local_name: String(l.name),
          matched: true,
          matched_rol: best.c.rol,
          matched_name: best.c.name,
          score: Number(best.score.toFixed(3)),
        });
      } else {
        results.push({
          local_code: String(l.code),
          local_name: String(l.name),
          matched: false,
          score: best ? Number(best.score.toFixed(3)) : 0,
          matched_name: best?.c.name ?? null,
          reason:
            !best
              ? "sin candidatos en bbox"
              : best.score < 0.5
                ? "similitud baja (<0.5)"
                : "candidato sin geometría",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        client_version: "v2-online",
        project_id: projectId,
        bbox: { xmin, ymin, xmax, ymax, radius_km: radiusKm },
        fetched: remote.length,
        upserted_to_national: upserted,
        local_concessions: local.length,
        matched: matchedCount,
        unmatched: local.length - matchedCount,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Compat: tipo importado para evitar unused warning si se mueve la lógica.
export type _Unused = CanonicalConcession;
