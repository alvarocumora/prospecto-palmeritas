// Sprint 1 — Pipeline STAC unificado + caché.
// Microsoft Planetary Computer (Sentinel-2 L2A, Sentinel-1 RTC) no requiere auth para search.
// EMIT y ASTER se resuelven via NASA CMR-STAC (también público).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COLLECTIONS = {
  s2: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "sentinel-2-l2a" },
  s1: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "sentinel-1-rtc" },
  emit: { stac: "https://cmr.earthdata.nasa.gov/stac/LPCLOUD", id: "EMITL2ARFL_v002" },
  aster: { stac: "https://cmr.earthdata.nasa.gov/stac/LPCLOUD", id: "ASTER_L1T_v003" },
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

const SearchInput = z.object({
  projectId: z.string().uuid(),
  collection: z.enum(["s2", "s1", "emit", "aster"]),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  dateFrom: z.string(),
  dateTo: z.string(),
  cloudCoverMax: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

// JSON-safe alias for serializable maps over the RPC boundary.
type JsonMap = { [k: string]: unknown };

export type StacItem = {
  id: string;
  collection: string;
  acquisitionDate: string;
  bbox: [number, number, number, number];
  cloudCover: number | null;
  thumbnailUrl: string | null;
  stacHref: string | null;
  assets: JsonMap;
  properties: JsonMap;
};

async function postSearch(stacUrl: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${stacUrl}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`STAC search failed [${res.status}]: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

function normalizeFeature(f: any, collection: string): StacItem {
  const props = (f?.properties ?? {}) as Record<string, unknown>;
  const assets = (f?.assets ?? {}) as Record<string, { href: string; type?: string; title?: string }>;
  const bbox = Array.isArray(f?.bbox) && f.bbox.length >= 4
    ? ([f.bbox[0], f.bbox[1], f.bbox[2], f.bbox[3]] as [number, number, number, number])
    : ([0, 0, 0, 0] as [number, number, number, number]);
  const dt = (props["datetime"] as string) ?? (props["start_datetime"] as string) ?? new Date().toISOString();
  const cloud = typeof props["eo:cloud_cover"] === "number"
    ? (props["eo:cloud_cover"] as number)
    : (typeof props["cloud_cover"] === "number" ? (props["cloud_cover"] as number) : null);
  const thumb = assets["thumbnail"]?.href ?? assets["rendered_preview"]?.href ?? assets["browse"]?.href ?? null;
  const self = (f?.links ?? []).find((l: any) => l?.rel === "self")?.href ?? null;
  return {
    id: String(f?.id ?? ""),
    collection,
    acquisitionDate: dt,
    bbox,
    cloudCover: cloud,
    thumbnailUrl: thumb,
    stacHref: self,
    assets,
    properties: props,
  };
}

export const searchStac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cfg = COLLECTIONS[data.collection as CollectionKey];

    const body: Record<string, unknown> = {
      collections: [cfg.id],
      bbox: data.bbox,
      datetime: `${data.dateFrom}/${data.dateTo}`,
      limit: data.limit,
    };
    if (data.cloudCoverMax !== undefined && (data.collection === "s2" || data.collection === "aster")) {
      body["query"] = { "eo:cloud_cover": { lt: data.cloudCoverMax } };
    }

    let items: StacItem[] = [];
    try {
      const result = (await postSearch(cfg.stac, body)) as { features?: unknown[] };
      items = (result.features ?? []).map((f) => normalizeFeature(f, cfg.id));
    } catch (err) {
      console.error("STAC search error", err);
      return { items: [] as StacItem[], error: (err as Error).message };
    }

    // Cache result in stac_acquisitions (best effort, ignore conflicts)
    if (items.length > 0) {
      const rows = items.slice(0, 50).map((it) => ({
        project_id: data.projectId,
        collection: cfg.id,
        scene_id: it.id,
        stac_href: it.stacHref,
        acquisition_date: it.acquisitionDate,
        bbox_geojson: { type: "Polygon", coordinates: [[
          [it.bbox[0], it.bbox[1]], [it.bbox[2], it.bbox[1]],
          [it.bbox[2], it.bbox[3]], [it.bbox[0], it.bbox[3]],
          [it.bbox[0], it.bbox[1]],
        ]] },
        cloud_pct: it.cloudCover,
        thumbnail_url: it.thumbnailUrl,
        assets: it.assets,
        properties: it.properties,
      }));
      const { error } = await supabase
        .from("stac_acquisitions")
        .upsert(rows, { onConflict: "project_id,collection,scene_id", ignoreDuplicates: true });
      if (error) console.warn("stac_acquisitions cache failed:", error.message);
    }

    return { items, error: null };
  });

// Sembrar productos hiperespectrales sintéticos / de demo a partir de una escena ASTER o EMIT.
// En sprints siguientes el worker Python hará el SAM real; aquí registramos productos derivados básicos.
const SeedHyperInput = z.object({
  projectId: z.string().uuid(),
  source: z.enum(["EMIT", "EnMAP", "ASTER", "Sentinel-2", "PRISMA"]),
  acquisitionDate: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  sceneId: z.string().optional(),
  stacHref: z.string().optional(),
});

export const seedHyperspectralFromScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SeedHyperInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bboxGeom = {
      type: "Polygon",
      coordinates: [[
        [data.bbox[0], data.bbox[1]], [data.bbox[2], data.bbox[1]],
        [data.bbox[2], data.bbox[3]], [data.bbox[0], data.bbox[3]],
        [data.bbox[0], data.bbox[1]],
      ]],
    };
    // Productos por defecto que ASTER/EMIT pueden derivar
    const products = [
      { mineral: "kaolinite", assemblage: "argillic", mean: 0.42, max: 0.78, area: 18.4 },
      { mineral: "alunite", assemblage: "advanced_argillic", mean: 0.31, max: 0.65, area: 7.1 },
      { mineral: "sericite", assemblage: "phyllic", mean: 0.55, max: 0.88, area: 22.6 },
      { mineral: "chlorite", assemblage: "propylitic", mean: 0.48, max: 0.72, area: 31.2 },
      { mineral: "hematite", assemblage: "iron_oxide_gossan", mean: 0.62, max: 0.91, area: 12.8 },
    ];
    const rows = products.map((p) => ({
      project_id: data.projectId,
      source: data.source,
      acquisition_date: data.acquisitionDate,
      scene_id: data.sceneId ?? null,
      stac_href: data.stacHref ?? null,
      bbox_geojson: bboxGeom,
      pixel_size_m: data.source === "ASTER" ? 30 : data.source === "EMIT" ? 60 : 30,
      mineral: p.mineral,
      assemblage: p.assemblage,
      mean_score: p.mean,
      max_score: p.max,
      area_ha: p.area,
      threshold: 0.5,
      algorithm: "SAM",
      spectral_library: "USGS_v7",
      created_by: userId,
      metadata: { seeded: true, note: "Productos derivados sintéticos pendientes de validación con worker Python real" },
    }));
    const { data: inserted, error } = await supabase
      .from("hyperspectral_products")
      .insert(rows)
      .select("*");
    if (error) return { ok: false, error: error.message, products: [] };
    return { ok: true, error: null, products: inserted ?? [] };
  });
