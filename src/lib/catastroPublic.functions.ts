import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  geometry: GeoJSON.Geometry | null;
  source: "cadastre_national" | "sernageomin";
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
// Helpers ArcGIS (fallback en vivo — SERNAGEOMIN v2, ver src/lib/sngm.ts)
// ============================================================
import { SNGM_CONCESIONES_URL, sngmQueryGeoJSON, sngmSanitizeTerm } from "@/lib/sngm";

function pick(props: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = props[k] ?? props[k.toUpperCase()] ?? props[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

type LiveCadastreRow = {
  code: string;
  concession_type: string;
  name: string | null;
  holder: string | null;
  rut: string | null;
  area_ha: number | null;
  status: string | null;
  region: string | null;
  commune: string | null;
  geometry?: GeoJSON.Geometry | null;
  raw?: Record<string, unknown>;
};

async function writeThroughCadastre(rows: LiveCadastreRow[]): Promise<void> {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const cadastreDb = supabaseAdmin as unknown as SupabaseClient;

  for (const r of rows) {
    const payload = {
      source: "SERNAGEOMIN",
      origen: "SERNAGEOMIN",
      external_id: r.code,
      rol: r.code,
      name: r.name,
      tipo: r.concession_type,
      status: r.status,
      holder_name: r.holder,
      holder_rut: r.rut,
      area_ha: r.area_ha,
      region: r.region,
      commune: r.commune,
      geometry_geojson: r.geometry ?? null,
      metadata: r.raw ?? {},
      fetched_at: now,
      archived_at: null,
    };

    const { data: existing, error: findError } = await cadastreDb
      .from("cadastre_national")
      .select("id, geometry_geojson")
      .eq("source", "SERNAGEOMIN")
      .eq("external_id", r.code)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (findError) throw new Error(`CADASTRE_WRITE_THROUGH_LOOKUP_FAILED: ${findError.message}`);

    if (existing) {
      const { error } = await cadastreDb
        .from("cadastre_national")
        .update({
          ...payload,
          geometry_geojson: r.geometry ?? existing.geometry_geojson ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(`CADASTRE_WRITE_THROUGH_UPDATE_FAILED: ${error.message}`);
    } else {
      const { error } = await cadastreDb.from("cadastre_national").insert(payload);
      if (error) throw new Error(`CADASTRE_WRITE_THROUGH_INSERT_FAILED: ${error.message}`);
    }
  }
}

function pickNum(props: Record<string, unknown>, ...keys: string[]): number | null {
  const v = pick(props, ...keys);
  if (!v) return null;
  const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchArcgisByCode(code: string): Promise<PublicConcession | null> {
  const safe = sngmSanitizeTerm(code);
  if (!safe) return null;
  // El "código" legacy corresponde en v2 al rol (numérico) o al nombre.
  const clauses = [`UPPER(NOMBRE) LIKE UPPER('%${safe}%')`];
  if (/^\d+$/.test(safe)) clauses.unshift(`NUMERO_ROL = ${safe}`);

  const fc = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    where: clauses.join(" OR "),
    limit: 1,
  });
  const f = fc?.features?.[0];
  if (!f) return null;
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const tipo =
    String(p.TIPO_CONCESION ?? "").toUpperCase() === "EXPLOTACION" ? "explotacion" : "exploracion";
  const rutNum = pick(p, "TITULAR_RUT");
  const rutDv = pick(p, "TITULAR_DV");
  const live: PublicConcession = {
    code,
    concession_type: tipo,
    name: pick(p, "NOMBRE"),
    holder: pick(p, "TITULAR_NOMBRE"),
    rut: rutNum ? `${rutNum}${rutDv ? `-${rutDv}` : ""}` : null,
    area_ha: pickNum(p, "HECTAREAS"),
    status: pick(p, "SITUACION_CONCESION"),
    region: pick(p, "REGION"),
    commune: pick(p, "COMUNA"),
    province: pick(p, "PROVINCIA"),
    expires_at: pick(p, "FECHA_VENCIMIENTO"),
    granted_at: null,
    centroid_lat: null,
    centroid_lng: null,
    geometry: (f.geometry ?? null) as GeoJSON.Geometry | null,
    source: "sernageomin",
    last_synced_at: null,
  };
  await writeThroughCadastre([{ ...live, raw: p }]);
  return live;
}

// ============================================================
// searchConcessions: full-text por titular / RUT / código / comuna
// ============================================================
export const searchConcessions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      q: z.string().trim().min(1).max(120),
      limit: z.number().int().min(1).max(50).optional(),
      region: z.string().trim().max(80).optional(),
      type: z.enum(["explotacion", "exploracion", "mensura", "manifestacion"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 25;
    const term = data.q.replace(/[%,]/g, " ");
    let query = supabaseAdmin
      .from("cadastre_national")
      .select("external_id, rol, name, tipo, status, holder_name, holder_rut, area_ha, region, commune")
      .is("archived_at", null)
      .or([
        `holder_name.ilike.%${term}%`,
        `name.ilike.%${term}%`,
        `rol.ilike.%${term}%`,
        `external_id.ilike.%${term}%`,
        `holder_rut.ilike.%${term}%`,
        `commune.ilike.%${term}%`,
      ].join(","))
      .limit(limit);
    if (data.region) query = query.ilike("region", `%${data.region}%`);
    if (data.type) query = query.ilike("tipo", `%${data.type}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if ((rows ?? []).length > 0) {
      const results = rows!.map((r) => ({
        code: r.rol ?? r.external_id,
        concession_type: r.tipo ?? "",
        name: r.name,
        holder: r.holder_name,
        rut: r.holder_rut,
        area_ha: r.area_ha == null ? null : Number(r.area_ha),
        status: r.status,
        region: r.region,
        commune: r.commune,
      }));
      return { results, total: results.length, source: "cadastre_national" as const };
    }

    const live = await searchConcessionsLive(data.q, limit);
    return { results: live, total: live.length, source: "sernageomin" as const };
  });

/** Búsqueda en vivo contra SERNAGEOMIN v2 (nombre, titular o rol). */
async function searchConcessionsLive(
  rawTerm: string,
  limit: number,
): Promise<
  Array<{
    code: string;
    concession_type: string;
    name: string | null;
    holder: string | null;
    rut: string | null;
    area_ha: number | null;
    status: string | null;
    region: string | null;
    commune: string | null;
  }>
> {
  const { SNGM_CONCESIONES_URL, sngmQueryGeoJSON, sngmSanitizeTerm } = await import("@/lib/sngm");
  const safe = sngmSanitizeTerm(rawTerm);
  if (!safe) return [];
  const clauses = [
    `UPPER(NOMBRE) LIKE UPPER('%${safe}%')`,
    `UPPER(TITULAR_NOMBRE) LIKE UPPER('%${safe}%')`,
  ];
  if (/^\d+$/.test(safe)) clauses.push(`NUMERO_ROL = ${safe}`);
  const fc = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
    where: clauses.join(" OR "),
    limit,
    returnGeometry: false,
  });
  const rows = (fc?.features ?? []).map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const rolNum = p.NUMERO_ROL;
    const rolDv = p.DV_ROL;
    const rutNum = p.TITULAR_RUT;
    const rutDv = p.TITULAR_DV;
    return {
      code:
        rolNum != null ? `${rolNum}${rolDv != null ? `-${rolDv}` : ""}` : String(p.NOMBRE ?? ""),
      concession_type:
        String(p.TIPO_CONCESION ?? "").toUpperCase() === "EXPLOTACION"
          ? "explotacion"
          : "exploracion",
      name: (p.NOMBRE as string) ?? null,
      holder: (p.TITULAR_NOMBRE as string) ?? null,
      rut: rutNum != null ? `${rutNum}${rutDv != null ? `-${rutDv}` : ""}` : null,
      area_ha: p.HECTAREAS != null ? Number(p.HECTAREAS) : null,
      status: (p.SITUACION_CONCESION as string) ?? null,
      region: (p.REGION as string) ?? null,
      commune: (p.COMUNA as string) ?? null,
    };
  });
  await writeThroughCadastre(rows);
  return rows;
}

// ============================================================
// getConcessionByCode: ficha pública (cache → ArcGIS fallback)
// ============================================================
export const getConcessionByCode = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicConcession | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("cadastre_national")
      .select("external_id, rol, name, tipo, status, holder_name, holder_rut, area_ha, region, commune, provincia, constituted_at, geometry_geojson, fetched_at")
      .is("archived_at", null)
      .or(`rol.eq.${data.code},external_id.eq.${data.code}`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      return {
        code: row.rol ?? row.external_id,
        concession_type: row.tipo ?? "",
        name: row.name,
        holder: row.holder_name,
        rut: row.holder_rut,
        area_ha: row.area_ha == null ? null : Number(row.area_ha),
        status: row.status,
        region: row.region,
        commune: row.commune,
        province: row.provincia,
        expires_at: null,
        granted_at: row.constituted_at,
        centroid_lat: null,
        centroid_lng: null,
        geometry: (row.geometry_geojson ?? null) as GeoJSON.Geometry | null,
        source: "cadastre_national",
        last_synced_at: row.fetched_at,
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

// ============================================================
// getConcessionLegalStatus: estado legal + patentes + boletín
// Conecta la situación SERNAGEOMIN (señal de patente/TGR) con las
// publicaciones del Boletín Oficial de Minería (mining_bulletins).
// ============================================================
export type ConcessionLegalStatus = {
  code: string;
  situacion: string | null;
  /** Interpretación de la situación como señal de patente/remate. */
  patent: {
    level: "ok" | "warn" | "critical" | "info" | "unknown";
    label: string;
    detail: string;
  };
  expiresAt: string | null;
  /** Publicaciones del Boletín Oficial de Minería para esta concesión. */
  bulletins: Array<{
    id: string;
    publication_type: string;
    publication_date: string | null;
    publication_number: string | null;
    source: string | null;
    source_url: string | null;
    holder_name: string | null;
  }>;
  /**
   * Morosidad CONFIRMADA: aparición en la nómina anual de remates por patente
   * impaga (patent_remates). Reemplaza la señal inferida cuando existe.
   */
  remate: {
    year: number;
    amount_clp: number | null;
    years_owed: number | null;
    court: string | null;
    court_role: string | null;
    status: string;
    source_url: string | null;
  } | null;
};

function interpretSituacion(
  situacion: string | null,
  expiresAt: string | null,
): ConcessionLegalStatus["patent"] {
  const s = (situacion ?? "").toUpperCase();
  if (s.includes("ELIMIN")) {
    return {
      level: "critical",
      label: "Concesión eliminada",
      detail:
        "Caducada o rematada — causa frecuente: patente minera impaga en la Tesorería General de la República (TGR). Oportunidad de manifestación sobre terreno liberado.",
    };
  }
  if (s.includes("TRAMITE") || s.includes("TRÁMITE")) {
    return {
      level: "info",
      label: "Solicitud en trámite",
      detail:
        "Manifestación o mensura publicada en el Boletín Oficial de Minería y en proceso de constitución. Aún no genera obligación de patente vigente.",
    };
  }
  if (s.includes("CONSTITU")) {
    // Riesgo por vencimiento cercano
    if (expiresAt) {
      const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
      if (days < 0)
        return {
          level: "critical",
          label: "Vigente · vencida en registro",
          detail:
            "La fecha de vencimiento ya pasó. Verifica el pago de patente en la TGR: patente impaga habilita el remate del terreno.",
        };
      if (days < 120)
        return {
          level: "warn",
          label: "Vigente · vencimiento próximo",
          detail:
            "Vencimiento en menos de 4 meses. La patente minera anual se paga en marzo a la TGR; el no pago lleva a remate.",
        };
    }
    return {
      level: "ok",
      label: "Vigente · constituida",
      detail:
        "Concesión constituida. Requiere pago anual de patente minera en la TGR (marzo) para mantener vigencia.",
    };
  }
  return {
    level: "unknown",
    label: situacion ?? "Situación desconocida",
    detail: "Consulta la situación de patente en la Tesorería General de la República (TGR).",
  };
}

export const getConcessionLegalStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }): Promise<ConcessionLegalStatus> => {
    // Situación + vencimiento en vivo desde SERNAGEOMIN.
    const concession = await fetchArcgisByCode(data.code);

    // Publicaciones del Boletín Oficial de Minería para esta concesión.
    const safe = data.code.replace(/[%,]/g, " ");
    const { data: bulletins } = await supabaseAdmin
      .from("mining_bulletins")
      .select(
        "id, publication_type, publication_date, publication_number, source, source_url, holder_name",
      )
      .or(`concession_code.ilike.%${safe}%,concession_name.ilike.%${safe}%`)
      .order("publication_date", { ascending: false })
      .limit(20);

    // Morosidad confirmada: nómina de remates por patente impaga (patent_remates).
    // Se consulta con el cliente sin tipar porque la tabla es nueva (aún no
    // regenerada en types.ts), siguiendo el patrón de payment_orders.
    const untyped = supabaseAdmin as unknown as SupabaseClient;
    const { data: remateRows } = await untyped
      .from("patent_remates")
      .select("year, amount_clp, years_owed, court, court_role, status, source_url")
      .eq("concession_code", data.code)
      .order("year", { ascending: false })
      .limit(1);
    const remate = (remateRows?.[0] ?? null) as ConcessionLegalStatus["remate"];

    // Si hay remate confirmado, sobrescribe la señal inferida.
    const patent = remate
      ? {
          level: "critical" as const,
          label: `En nómina de remate ${remate.year} · patente impaga`,
          detail: `Concesión incluida en la nómina de remate por no pago de patente minera a la TGR${
            remate.years_owed ? ` (${remate.years_owed} año(s) adeudado(s))` : ""
          }${
            remate.amount_clp ? `, deuda $${remate.amount_clp.toLocaleString("es-CL")} CLP` : ""
          }${remate.court ? ` · ${remate.court}` : ""}. Terreno en riesgo de subasta pública.`,
        }
      : interpretSituacion(concession?.status ?? null, concession?.expires_at ?? null);

    return {
      code: data.code,
      situacion: concession?.status ?? null,
      patent,
      expiresAt: concession?.expires_at ?? null,
      bulletins: (bulletins ?? []) as ConcessionLegalStatus["bulletins"],
      remate,
    };
  });
