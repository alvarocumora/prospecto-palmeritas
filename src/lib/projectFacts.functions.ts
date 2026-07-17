// Fuente única de verdad ("project facts") para proyectos publicados.
// Consumida por: /proyectos (mapa + drawer), ValuationPanel, PDF de docs
// que referencian un proyecto, informes pre-NI 43-101 y páginas /live/*.
//
// Regla: cualquier UI o export que muestre coordenadas, área, precio pedido
// o valorización P50 debe leer desde aquí y NO desde hojas estáticas.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ProjectFacts = {
  projectId: string | null;
  listingId: string | null;
  name: string;
  code: string | null;
  commodity: string | null;
  stage: string | null;
  country: string | null;
  region: string | null;
  location: string | null;
  areaHa: number | null;
  centroid: [number, number] | null; // [lng, lat] — orden GeoJSON
  askingPriceUsd: number | null;
  valuationP50Usd: number | null;
  npvUsd: number | null;
  irrPct: number | null;
  sourceUpdatedAt: string;
};

function serverPublicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getProjectFacts = createServerFn({ method: "GET" })
  .inputValidator((input: { projectId?: string; listingId?: string }) => {
    if (!input?.projectId && !input?.listingId) {
      throw new Error("projectId o listingId requerido");
    }
    return input;
  })
  .handler(async ({ data }): Promise<ProjectFacts | null> => {
    const sb = serverPublicClient();

    // 1. Resolver listing (fuente canónica de asking + geometría publicada).
    const listingQuery = sb
      .from("property_listings")
      .select(
        "id,title,code,commodity,country,region,stage,area_ha,asking_price_usd,geometry_geojson,project_id",
      )
      .eq("is_published", true)
      .limit(1);
    const { data: listing } = data.listingId
      ? await listingQuery.eq("id", data.listingId).maybeSingle()
      : await listingQuery.eq("project_id", data.projectId!).maybeSingle();

    // 2. Resolver proyecto (fuente canónica de centroide oficial).
    const projectId = listing?.project_id ?? data.projectId ?? null;
    type ProjectRow = {
      id: string;
      name: string;
      code: string | null;
      commodity: string | null;
      country: string | null;
      region: string | null;
      center_lat: number | null;
      center_lng: number | null;
    };
    let project: ProjectRow | null = null;
    if (projectId) {
      const { data: p } = await sb
        .from("projects")
        .select("id,name,code,commodity,country,region,center_lat,center_lng")
        .eq("id", projectId)
        .maybeSingle();
      project = (p as ProjectRow | null) ?? null;
    }

    if (!listing && !project) return null;

    // 3. Centroide reconciliado: proyecto > geometry_geojson del listing.
    let centroid: [number, number] | null = null;
    if (project?.center_lat != null && project?.center_lng != null) {
      centroid = [Number(project.center_lng), Number(project.center_lat)];
    } else if (listing?.geometry_geojson) {
      const g =
        typeof listing.geometry_geojson === "string"
          ? safeParse(listing.geometry_geojson)
          : (listing.geometry_geojson as unknown);
      const coords = (g as { type?: string; coordinates?: [number, number] } | null)?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        centroid = [Number(coords[0]), Number(coords[1])];
      }
    }

    // 4. Valorización live: último escenario económico + P50 del ValuationPanel.
    let npvUsd: number | null = null;
    let irrPct: number | null = null;
    if (projectId) {
      const { data: sc } = await sb
        .from("economic_scenarios")
        .select("npv_usd,irr_pct,updated_at")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sc) {
        npvUsd = sc.npv_usd != null ? Number(sc.npv_usd) : null;
        irrPct = sc.irr_pct != null ? Number(sc.irr_pct) : null;
      }
    }

    const name = project?.name ?? listing?.title ?? "Proyecto";
    const region = project?.region ?? listing?.region ?? null;
    const country = project?.country ?? listing?.country ?? "Chile";
    const location = [region, country].filter(Boolean).join(", ") || null;

    return {
      projectId,
      listingId: listing?.id ?? null,
      name,
      code: project?.code ?? listing?.code ?? null,
      commodity: project?.commodity ?? listing?.commodity ?? null,
      stage: listing?.stage ?? null,
      country,
      region,
      location,
      areaHa: listing?.area_ha != null ? Number(listing.area_ha) : null,
      centroid,
      askingPriceUsd: listing?.asking_price_usd != null ? Number(listing.asking_price_usd) : null,
      // P50 valuación se calcula bajo demanda en ValuationPanel; aquí exponemos
      // NPV como proxy comparable para reportes/PDF cuando existe.
      valuationP50Usd: npvUsd,
      npvUsd,
      irrPct,
      sourceUpdatedAt: new Date().toISOString(),
    };
  });

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
