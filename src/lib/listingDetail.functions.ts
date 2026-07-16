// Server fn pública: devuelve la ficha completa de un property_listing publicado
// con métricas técnicas agregadas (sin exponer PII ni datos granulares).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ListingDetail = {
  id: string;
  title: string;
  code: string | null;
  commodity: string | null;
  country: string | null;
  region: string | null;
  area_ha: number | null;
  stage: string | null;
  modality: string | null;
  asking_price_usd: number | null;
  royalty_pct: number | null;
  summary: string | null;
  cover_image_url: string | null;
  data_available: string[] | null;
  is_featured: boolean;
  views_count: number;
  project_id: string | null;
  centroid: [number, number] | null;
  // Métricas agregadas
  metrics: {
    concessionsTotal: number;
    concessionsArea: number | null;
    drillHoles: number;
    metersDrilled: number | null;
    samples: number;
    satelliteAnomalies: number;
    targets: number;
    ni43101Reports: number;
  };
  comparables: Array<{
    id: string;
    name: string | null;
    metric_label: string | null;
    metric_value: number | null;
    notes: string | null;
  }>;
  // Inventario del data room — solo agregados (sin nombres de archivo):
  // el detalle es visible tras KYC + NDA dentro de la plataforma.
  dataRoom: {
    totalFiles: number;
    ndaFiles: number;
    totalSizeBytes: number;
    categories: Array<{ category: string; count: number }>;
  };
  inquiriesCount: number;
};

const inputSchema = z.object({ id: z.string().uuid() });

const REGION_CENTROID: Record<string, [number, number]> = {
  "Arica y Parinacota": [-69.59, -18.48],
  Tarapacá: [-69.6, -20.2],
  Antofagasta: [-69.0, -23.65],
  Atacama: [-69.9, -27.5],
  Coquimbo: [-70.95, -30.5],
  Valparaíso: [-71.5, -32.8],
  Metropolitana: [-70.65, -33.45],
  "O'Higgins": [-70.95, -34.55],
};

function centroidOf(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown };
  try {
    let sx = 0,
      sy = 0,
      n = 0;
    const walk = (c: unknown) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number") {
        sx += c[0];
        sy += c[1];
        n++;
      } else for (const x of c) walk(x);
    };
    walk(g.coordinates);
    if (!n) return null;
    return [sx / n, sy / n];
  } catch {
    return null;
  }
}

export const getListingDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<ListingDetail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.id;

    const { data: row, error } = await supabaseAdmin
      .from("property_listings")
      .select(
        "id,title,code,commodity,country,region,area_ha,stage,modality,asking_price_usd,royalty_pct,summary,cover_image_url,data_available,is_featured,views_count,project_id,geometry_geojson,projects:projects(center_lat,center_lng)",
      )
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !row) return null;

    // Bump view count (best-effort, ignore failures)
    supabaseAdmin
      .from("property_listings")
      .update({ views_count: (row.views_count ?? 0) + 1 })
      .eq("id", id)
      .then(() => {});

    let centroid = centroidOf(
      typeof row.geometry_geojson === "string"
        ? JSON.parse(row.geometry_geojson)
        : row.geometry_geojson,
    );
    if (!centroid) {
      const pc = row.projects as unknown as {
        center_lat: number | null;
        center_lng: number | null;
      } | null;
      if (pc?.center_lat != null && pc?.center_lng != null) {
        centroid = [Number(pc.center_lng), Number(pc.center_lat)];
      } else if (row.region && REGION_CENTROID[row.region]) {
        centroid = REGION_CENTROID[row.region];
      }
    }

    // Métricas agregadas — todas son COUNTs/SUMs, sin PII
    const metrics = {
      concessionsTotal: 0,
      concessionsArea: null as number | null,
      drillHoles: 0,
      metersDrilled: null as number | null,
      samples: 0,
      satelliteAnomalies: 0,
      targets: 0,
      ni43101Reports: 0,
    };
    const comparables: ListingDetail["comparables"] = [];

    if (row.project_id) {
      const pid = row.project_id;
      const [conc, holes, samp, anom, tgt, rep] = await Promise.all([
        supabaseAdmin
          .from("mining_concessions")
          .select("id,area_ha", { count: "exact", head: false })
          .eq("project_id", pid),
        supabaseAdmin
          .from("drill_holes")
          .select("id,total_depth_m", { count: "exact", head: false })
          .eq("project_id", pid),
        supabaseAdmin
          .from("sampling_results")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid),
        supabaseAdmin
          .from("satellite_anomalies")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid),
        supabaseAdmin
          .from("exploration_targets")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid),
        supabaseAdmin
          .from("technical_reports")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid),
      ]);
      metrics.concessionsTotal = conc.count ?? conc.data?.length ?? 0;
      metrics.concessionsArea =
        (conc.data ?? []).reduce((s, r) => s + (Number(r.area_ha) || 0), 0) || null;
      metrics.drillHoles = holes.count ?? holes.data?.length ?? 0;
      metrics.metersDrilled =
        (holes.data ?? []).reduce(
          (s, r) => s + (Number((r as { total_depth_m?: number | null }).total_depth_m) || 0),
          0,
        ) || null;
      metrics.samples = samp.count ?? 0;
      metrics.satelliteAnomalies = anom.count ?? 0;
      metrics.targets = tgt.count ?? 0;
      metrics.ni43101Reports = rep.count ?? 0;
    }

    // Inventario del data room (agregados, sin nombres de archivo)
    const dataRoom: ListingDetail["dataRoom"] = {
      totalFiles: 0,
      ndaFiles: 0,
      totalSizeBytes: 0,
      categories: [],
    };
    {
      const { data: drFiles } = await supabaseAdmin
        .from("property_data_room_files")
        .select("category, requires_nda, file_size_bytes")
        .eq("listing_id", row.id);
      const byCat = new Map<string, number>();
      for (const f of drFiles ?? []) {
        dataRoom.totalFiles += 1;
        if (f.requires_nda) dataRoom.ndaFiles += 1;
        dataRoom.totalSizeBytes += Number(f.file_size_bytes) || 0;
        const cat = f.category ?? "otros";
        byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
      }
      dataRoom.categories = Array.from(byCat.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    }

    // Contador de interesados (inquiries) — señal social de tracción
    let inquiriesCount = 0;
    {
      const { count } = await supabaseAdmin
        .from("property_deal_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", row.id);
      inquiriesCount = count ?? 0;
    }

    return {
      id: row.id,
      title: row.title,
      code: row.code ?? null,
      commodity: row.commodity ?? null,
      country: row.country ?? null,
      region: row.region ?? null,
      area_ha: row.area_ha != null ? Number(row.area_ha) : null,
      stage: row.stage ?? null,
      modality: row.modality ?? null,
      asking_price_usd: row.asking_price_usd != null ? Number(row.asking_price_usd) : null,
      royalty_pct: row.royalty_pct != null ? Number(row.royalty_pct) : null,
      summary: row.summary ?? null,
      cover_image_url: row.cover_image_url ?? null,
      data_available: row.data_available ?? null,
      is_featured: !!row.is_featured,
      views_count: row.views_count ?? 0,
      project_id: row.project_id ?? null,
      centroid,
      metrics,
      comparables,
      dataRoom,
      inquiriesCount,
    };
  });
