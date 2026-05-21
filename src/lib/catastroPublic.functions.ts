import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============================================================
// Tipos
// ============================================================
export type PublicConcession = {
  code: string;
  concession_type: string;
  name: string | null;
  holder: string | null;
  rut: string | null;
  area_ha: number | null;
  status: string | null;
  region: string | null;
  commune: string | null;
  province: string | null;
  expires_at: string | null;
  granted_at: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  geometry: unknown | null;
  source: "cache" | "sernageomin";
  last_synced_at: string | null;
};

export type PublicHolder = {
  rut: string | null;
  holder_name: string;
  holder_slug: string;
  total_concessions: number;
  total_area_ha: number;
  regions: string[];
};

// ============================================================
// Helpers ArcGIS (fallback en vivo)
// ============================================================
const ARCGIS_BASE =
  "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer";
const LAYERS: Array<{ id: number; type: PublicConcession["concession_type"] }> = [
  { id: 0, type: "explotacion" },
  { id: 1, type: "exploracion" },
];

function pick(props: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = props[k] ?? props[k.toUpperCase()] ?? props[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}
function pickNum(props: Record<string, unknown>, ...keys: string[]): number | null {
  const v = pick(props, ...keys);
  if (!v) return null;
  const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchArcgisByCode(code: string): Promise<PublicConcession | null> {
  for (const layer of LAYERS) {
    const params = new URLSearchParams({
      where: `CODIGO = '${code.replace(/'/g, "''")}' OR ROL = '${code.replace(/'/g, "''")}'`,
      outFields: "*",
      outSR: "4326",
      f: "geojson",
      resultRecordCount: "1",
    });
    try {
      const res = await fetch(`${ARCGIS_BASE}/${layer.id}/query?${params.toString()}`);
      if (!res.ok) continue;
      const fc = (await res.json()) as {
        features?: Array<{ properties: Record<string, unknown>; geometry: unknown }>;
      };
      const f = fc.features?.[0];
      if (!f) continue;
      const p = f.properties ?? {};
      return {
        code,
        concession_type: layer.type,
        name: pick(p, "NOMBRE", "NOM_PERTEN", "NOM_CONCES"),
        holder: pick(p, "TITULAR", "NOMBRE_TIT", "NOM_TITULA"),
        rut: pick(p, "RUT", "RUT_TITULA"),
        area_ha: pickNum(p, "AREA_HA", "HECTAREAS", "SUPERFICIE"),
        status: pick(p, "VIGENCIA", "ESTADO"),
        region: pick(p, "REGION", "NOM_REGION"),
        commune: pick(p, "COMUNA", "NOM_COMUNA"),
        province: pick(p, "PROVINCIA", "NOM_PROV"),
        expires_at: null,
        granted_at: null,
        centroid_lat: null,
        centroid_lng: null,
        geometry: f.geometry,
        source: "sernageomin",
        last_synced_at: null,
      };
    } catch {
      // continue
    }
  }
  return null;
}

// ============================================================
// searchConcessions: full-text por titular / RUT / código / comuna
// ============================================================
export const searchConcessions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        q: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(50).optional(),
        region: z.string().trim().max(80).optional(),
        type: z.enum(["explotacion", "exploracion", "mensura", "manifestacion"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 25;
    let query = supabaseAdmin
      .from("public_concessions_cache")
      .select(
        "code, concession_type, name, holder, rut, area_ha, status, region, commune",
      )
      .limit(limit);

    // text matching across multiple fields
    const term = data.q.replace(/[%,]/g, " ");
    query = query.or(
      [
        `holder.ilike.%${term}%`,
        `name.ilike.%${term}%`,
        `code.ilike.%${term}%`,
        `rut.ilike.%${term}%`,
        `commune.ilike.%${term}%`,
      ].join(","),
    );

    if (data.region) query = query.eq("region_slug", data.region);
    if (data.type) query = query.eq("concession_type", data.type);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { results: rows ?? [], total: rows?.length ?? 0 };
  });

// ============================================================
// getConcessionByCode: ficha pública (cache → ArcGIS fallback)
// ============================================================
export const getConcessionByCode = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicConcession | null> => {
    const { data: row } = await supabaseAdmin
      .from("public_concessions_cache")
      .select(
        "code, concession_type, name, holder, rut, area_ha, status, region, commune, province, expires_at, granted_at, geometry, last_synced_at",
      )
      .eq("code", data.code)
      .maybeSingle();

    if (row) {
      return {
        code: row.code,
        concession_type: row.concession_type,
        name: row.name,
        holder: row.holder,
        rut: row.rut,
        area_ha: row.area_ha,
        status: row.status,
        region: row.region,
        commune: row.commune,
        province: row.province,
        expires_at: row.expires_at,
        granted_at: row.granted_at,
        centroid_lat: null,
        centroid_lng: null,
        geometry: row.geometry,
        source: "cache",
        last_synced_at: row.last_synced_at,
      };
    }

    return fetchArcgisByCode(data.code);
  });

// ============================================================
// getHolderByRut: perfil agregado
// ============================================================
export const getHolderByRut = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ rut: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: holder } = await supabaseAdmin
      .from("public_holders")
      .select("*")
      .eq("rut", data.rut)
      .maybeSingle();

    const { data: concessions } = await supabaseAdmin
      .from("public_concessions_cache")
      .select("code, name, concession_type, area_ha, region, commune, status")
      .eq("rut", data.rut)
      .limit(500);

    return {
      holder: (holder ?? null) as PublicHolder | null,
      concessions: concessions ?? [],
    };
  });

// ============================================================
// getRegionStats: agregados por región
// ============================================================
export const getRegionStats = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(60).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.slug) {
      const { data: rows } = await supabaseAdmin
        .from("public_concessions_cache")
        .select("code, name, holder, area_ha, concession_type, commune, status")
        .eq("region_slug", data.slug)
        .limit(500);
      return { region: data.slug, concessions: rows ?? [] };
    }
    // Resumen nacional desde holders
    const { data: top } = await supabaseAdmin
      .from("public_holders")
      .select("holder_name, holder_slug, total_concessions, total_area_ha, regions")
      .order("total_area_ha", { ascending: false })
      .limit(20);
    return { topHolders: top ?? [] };
  });

// ============================================================
// getMyPlan: plan del usuario actual (default 'free')
// ============================================================
export const getMyPlan = createServerFn({ method: "GET" }).handler(async () => {
  // Sin auth middleware: si no hay user retornamos 'free' anónimo
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization");
    if (!auth) return { plan: "free" as const, anonymous: true };
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return { plan: "free" as const, anonymous: true };
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return {
      plan: (sub?.plan ?? "free") as "free" | "pro" | "enterprise",
      status: sub?.status ?? "active",
      anonymous: false,
    };
  } catch {
    return { plan: "free" as const, anonymous: true };
  }
});
