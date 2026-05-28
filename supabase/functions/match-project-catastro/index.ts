// Edge Function: match-project-catastro
//
// Descarga TODOS los polígonos vigentes/exploración de SERNAGEOMIN dentro del
// bounding box del proyecto, los persiste en `cadastre_national` y enlaza por
// similitud de nombre cada `mining_concessions` del proyecto a su polígono
// oficial, escribiendo `geometry_geojson`, `area_ha`, `external_id` (ROL),
// `holder` y `source = 'sernageomin'`.
//
// Body: { projectId: string, radiusKm?: number, dryRun?: boolean }
// Returns: { ok, fetched, matched, unmatched, results: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";
// 0 = Explotación, 1 = Exploración
const LAYERS = [0, 1] as const;

type ArcFeature = {
  attributes: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
};

function ringsToGeoJson(rings?: number[][][]): GeoJSON.Geometry | null {
  if (!rings?.length) return null;
  if (rings.length === 1) return { type: "Polygon", coordinates: rings };
  return { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
}

function pickStr(a: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = a[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}
function pickNum(a: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
function parseDate(a: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = a[k];
    if (v == null || v === "") continue;
    if (typeof v === "number") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function mapStatus(a: Record<string, unknown>): string {
  const s = (pickStr(a, ["VIGENCIA", "ESTADO", "SITUACION"]) ?? "").toLowerCase();
  if (s.includes("vig")) return "vigente";
  if (s.includes("tram")) return "en_tramite";
  if (s.includes("venc") || s.includes("cadu")) return "vencida";
  if (s.includes("cancel")) return "cancelada";
  return "vigente";
}

// Normaliza el nombre para comparar: minúsculas, sin acentos, sin signos,
// colapsa espacios y descarta sufijos comunes como "1-30", "1/12", "5-1-12".
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/_.]+/g, " ")
    .replace(/\b\d+\s*[-]\s*\d+(\s*[-]\s*\d+)?\b/g, " ") // 1-30, 5-1-12
    .replace(/\b\d+\b/g, " ")                              // numeros sueltos
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

async function fetchLayerInBbox(
  layer: number,
  xmin: number,
  ymin: number,
  xmax: number,
  ymax: number,
): Promise<ArcFeature[]> {
  const out: ArcFeature[] = [];
  let offset = 0;
  // SERNAGEOMIN typical maxRecordCount = 1000
  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "true",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: "1000",
    });
    const url = `${ARCGIS_BASE}/${layer}/query?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ArcGIS layer ${layer} HTTP ${res.status}`);
    }
    const json = (await res.json()) as { features?: ArcFeature[]; exceededTransferLimit?: boolean };
    const feats = json.features ?? [];
    out.push(...feats);
    if (!json.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
    if (offset > 20_000) break; // safety
  }
  return out;
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

    // 1) Proyecto + concesiones internas a enlazar
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

    // 2) BBOX (~radiusKm a la redonda)
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const xmin = lng - dLng;
    const xmax = lng + dLng;
    const ymin = lat - dLat;
    const ymax = lat + dLat;

    // 3) Descarga SERNAGEOMIN
    const allFeats: Array<{ feat: ArcFeature; layer: number }> = [];
    for (const layer of LAYERS) {
      const feats = await fetchLayerInBbox(layer, xmin, ymin, xmax, ymax);
      for (const f of feats) allFeats.push({ feat: f, layer });
    }

    // 4) Persiste en cadastre_national (idempotente via upsert_cadastre_feature)
    let upserted = 0;
    for (const { feat, layer } of allFeats) {
      const a = feat.attributes;
      const geom = ringsToGeoJson(feat.geometry?.rings);
      const externalId =
        pickStr(a, ["OBJECTID", "OBJECT_ID", "CODIGO", "ROL", "COD_EXPED"]) ??
        crypto.randomUUID();
      const origen = layer === 0 ? "EXPLOTACION" : "EXPLORACION";
      const payload = {
        rol: pickStr(a, ["ROL", "CODIGO", "COD_EXPED"]),
        name: pickStr(a, ["NOMBRE", "NOM_PERT", "NOM_CONCES"]),
        tipo: layer === 0 ? "explotacion" : "exploracion",
        status: mapStatus(a),
        area_ha: pickNum(a, ["AREA_HA", "HECTAREAS", "SUPERFICIE", "SUP_HA"]),
        region: pickStr(a, ["REGION", "NOM_REGION"]),
        commune: pickStr(a, ["COMUNA", "NOM_COMUNA"]),
        provincia: pickStr(a, ["PROVINCIA", "NOM_PROVIN"]),
        holder_name: pickStr(a, ["TITULAR", "NOMBRE_TIT", "NOM_TITULA"]),
        holder_rut: pickStr(a, ["RUT_TIT", "RUT_TITULA", "RUT"]),
        constituted_at: parseDate(a, ["FEC_INSC", "FECHA_INSC", "FEC_OTORG"]),
        last_patent_year: pickNum(a, ["ANNO_PATEN", "ANO_PATENT", "AGNO_PAT"]),
        datum: "WGS84",
        metadata: { layer, source_attrs: a },
      };
      if (!dryRun) {
        const { error: upErr } = await supabase.rpc("upsert_cadastre_feature", {
          _origen: origen,
          _external_id: externalId,
          _payload: payload,
          _geometry_geojson: geom,
        });
        if (!upErr) upserted++;
      } else {
        upserted++;
      }
    }

    // 5) Matching por nombre normalizado + Jaccard de tokens
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

    const candidates = allFeats
      .map(({ feat, layer }) => {
        const a = feat.attributes;
        const name = pickStr(a, ["NOMBRE", "NOM_PERT", "NOM_CONCES"]);
        if (!name) return null;
        return {
          name,
          norm: normalizeName(name),
          rol: pickStr(a, ["ROL", "CODIGO", "COD_EXPED"]),
          holder: pickStr(a, ["TITULAR", "NOMBRE_TIT", "NOM_TITULA"]),
          area_ha: pickNum(a, ["AREA_HA", "HECTAREAS", "SUPERFICIE", "SUP_HA"]),
          geom: ringsToGeoJson(feat.geometry?.rings),
          layer,
          status: mapStatus(a),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

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
      let best: { c: (typeof candidates)[number]; score: number } | null = null;
      for (const c of candidates) {
        const score = tokenJaccard(target, c.norm);
        if (best == null || score > best.score) best = { c, score };
      }
      // Umbral: ≥ 0.5 (al menos la mitad de los tokens significativos coinciden)
      if (best && best.score >= 0.5 && best.c.geom) {
        matchedCount++;
        if (!dryRun) {
          const update: Record<string, unknown> = {
            geometry_geojson: best.c.geom,
            source: "sernageomin",
            datum: "WGS84",
            last_synced_at: new Date().toISOString(),
          };
          if (best.c.area_ha != null) update.area_ha = best.c.area_ha;
          if (best.c.rol) update.external_id = best.c.rol;
          if (best.c.holder) update.holder = best.c.holder;
          if (best.c.status) update.status = best.c.status;
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
        project_id: projectId,
        bbox: { xmin, ymin, xmax, ymax, radius_km: radiusKm },
        fetched: allFeats.length,
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
