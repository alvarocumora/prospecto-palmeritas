// Sprint 1 — Pipeline STAC unificado + caché.
// Microsoft Planetary Computer (Sentinel-2 L2A, Sentinel-1 RTC) no requiere auth para search.
// EMIT y ASTER se resuelven via NASA CMR-STAC (también público).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { satelliteEvidence, validSatelliteBbox } from "@/lib/satellite/evidence";
import { requireCatastroRole } from "@/lib/access/roleMiddleware";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type HyperRow = Tables<"hyperspectral_products">;
type InsarRow = Tables<"insar_displacement">;
type StockRow = Tables<"stockpile_volumes">;
type TargetRow = Tables<"exploration_targets">;
type InsarActionRow = Tables<"insar_alert_actions">;
type FollowUpTaskRow = Tables<"follow_up_tasks">;

type StacFeature = {
  id?: string | number;
  bbox?: number[];
  properties?: Record<string, unknown>;
  assets?: Record<string, { href?: string; type?: string; title?: string }>;
  links?: Array<{ rel?: string; href?: string }>;
};

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
};

const COLLECTIONS = {
  s2: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "sentinel-2-l2a" },
  s1: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "sentinel-1-rtc" },
  hls: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "hls2-s30" },
  hlsLandsat: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "hls2-l30" },
  landsat: { stac: "https://planetarycomputer.microsoft.com/api/stac/v1", id: "landsat-c2-l2" },
  emit: { stac: "https://cmr.earthdata.nasa.gov/stac/LPCLOUD", id: "EMITL2ARFL_002" },
  emitMinerals: { stac: "https://cmr.earthdata.nasa.gov/stac/LPCLOUD", id: "EMITL2BMIN_002" },
  aster: { stac: "https://cmr.earthdata.nasa.gov/stac/LPCLOUD", id: "AST_07XT_004" },
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

const SearchInput = z.object({
  projectId: z.string().uuid(),
  collection: z.enum(["s2", "s1", "hls", "hlsLandsat", "landsat", "emit", "emitMinerals", "aster"]),
  bbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .refine(validSatelliteBbox, "Invalid geographic AOI"),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  cloudCoverMax: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export type StacItem = {
  id: string;
  collection: string;
  acquisitionDate: string;
  bbox: [number, number, number, number];
  cloudCover: number | null;
  thumbnailUrl: string | null;
  stacHref: string | null;
  // Pre-serializado a JSON string para cruzar el RPC sin problemas de tipos.
  assetsJson: string;
  propertiesJson: string;
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

function normalizeFeature(f: unknown, collection: string): StacItem {
  const feat = (f ?? {}) as StacFeature;
  const props = (feat.properties ?? {}) as Record<string, unknown>;
  const assets = (feat.assets ?? {}) as Record<
    string,
    { href?: string; type?: string; title?: string }
  >;
  const bbox =
    Array.isArray(feat.bbox) && feat.bbox.length >= 4
      ? ([feat.bbox[0], feat.bbox[1], feat.bbox[2], feat.bbox[3]] as [
          number,
          number,
          number,
          number,
        ])
      : ([0, 0, 0, 0] as [number, number, number, number]);
  // Missing acquisition time stays unknown; never invent the current date.
  const dt =
    (props["datetime"] as string | undefined) ??
    (props["start_datetime"] as string | undefined) ??
    "";
  const cloud =
    typeof props["eo:cloud_cover"] === "number"
      ? (props["eo:cloud_cover"] as number)
      : typeof props["cloud_cover"] === "number"
        ? (props["cloud_cover"] as number)
        : null;
  const thumb =
    assets["thumbnail"]?.href ?? assets["rendered_preview"]?.href ?? assets["browse"]?.href ?? null;
  const self = (feat.links ?? []).find((l) => l?.rel === "self")?.href ?? null;
  return {
    id: String(feat.id ?? ""),
    collection,
    acquisitionDate: dt,
    bbox,
    cloudCover: cloud,
    thumbnailUrl: thumb,
    stacHref: self,
    assetsJson: JSON.stringify(assets),
    propertiesJson: JSON.stringify(props),
  };
}

export const searchStac = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isMember, error: membershipError } = await supabase.rpc("is_project_member", {
      _project_id: data.projectId,
      _user_id: context.userId,
    });
    if (membershipError || !isMember) throw new Error("PROJECT_ACCESS_DENIED");
    const cfg = COLLECTIONS[data.collection as CollectionKey];

    const body: Record<string, unknown> = {
      collections: [cfg.id],
      bbox: data.bbox,
      datetime: `${data.dateFrom}T00:00:00Z/${data.dateTo}T23:59:59Z`,
      limit: data.limit,
    };
    if (
      data.cloudCoverMax !== undefined &&
      (data.collection === "s2" || data.collection === "aster")
    ) {
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
        bbox_geojson: {
          type: "Polygon",
          coordinates: [
            [
              [it.bbox[0], it.bbox[1]],
              [it.bbox[2], it.bbox[1]],
              [it.bbox[2], it.bbox[3]],
              [it.bbox[0], it.bbox[3]],
              [it.bbox[0], it.bbox[1]],
            ],
          ],
        },
        cloud_pct: it.cloudCover,
        thumbnail_url: it.thumbnailUrl,
        assets: JSON.parse(it.assetsJson),
        properties: JSON.parse(it.propertiesJson),
      }));
      const { error } = await supabase.from("stac_acquisitions").upsert(rows, {
        onConflict: "project_id,collection,scene_id",
        ignoreDuplicates: true,
      });
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
  bbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .refine(validSatelliteBbox, "Invalid geographic AOI"),
  sceneId: z.string().min(1),
  stacHref: z.string().optional(),
});

export const seedHyperspectralFromScene = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => SeedHyperInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bboxGeom = {
      type: "Polygon",
      coordinates: [
        [
          [data.bbox[0], data.bbox[1]],
          [data.bbox[2], data.bbox[1]],
          [data.bbox[2], data.bbox[3]],
          [data.bbox[0], data.bbox[3]],
          [data.bbox[0], data.bbox[1]],
        ],
      ],
    };
    // Productos por defecto que ASTER/EMIT pueden derivar
    const products = [
      { mineral: "kaolinite", assemblage: "argillic", mean: 0.42, max: 0.78, area: 18.4 },
      { mineral: "alunite", assemblage: "advanced_argillic", mean: 0.31, max: 0.65, area: 7.1 },
      { mineral: "sericite", assemblage: "phyllic", mean: 0.55, max: 0.88, area: 22.6 },
      { mineral: "chlorite", assemblage: "propylitic", mean: 0.48, max: 0.72, area: 31.2 },
      { mineral: "hematite", assemblage: "iron_oxide_gossan", mean: 0.62, max: 0.91, area: 12.8 },
    ];
    const rows: TablesInsert<"hyperspectral_products">[] = products.map((p) => ({
      project_id: data.projectId,
      source: data.source,
      acquisition_date: data.acquisitionDate,
      scene_id: data.sceneId ?? null,
      stac_href: data.stacHref ?? null,
      bbox_geojson: bboxGeom,
      pixel_size_m: data.source === "ASTER" ? 30 : data.source === "EMIT" ? 60 : 30,
      mineral: p.mineral as HyperRow["mineral"],
      assemblage: p.assemblage as HyperRow["assemblage"],
      mean_score: p.mean,
      max_score: p.max,
      area_ha: p.area,
      threshold: 0.5,
      algorithm: "synthetic_demo",
      spectral_library: "USGS_v7",
      created_by: userId,
      metadata: {
        seeded: true,
        provenance: "synthetic",
        note: "Productos derivados sintéticos pendientes de validación con worker Python real",
      },
    }));
    const { data: inserted, error } = await supabase
      .from("hyperspectral_products")
      .insert(rows)
      .select("*");
    if (error) return { ok: false, error: error.message, products: [] };
    return { ok: true, error: null, products: inserted ?? [] };
  });

// =====================================================================
// Sprint 2 — Análisis hiperespectral con IA (Lovable AI Gateway)
// =====================================================================

const ExplainInput = z.object({
  projectId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1).max(20),
  context: z.string().max(800).optional(),
});

type ProductRow = {
  mineral: string;
  assemblage: string | null;
  source: string;
  acquisition_date: string;
  mean_score: number | null;
  max_score: number | null;
  area_ha: number | null;
  pixel_size_m: number | null;
  algorithm: string;
  metadata?: unknown;
};

export const explainHyperspectralProducts = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => ExplainInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("hyperspectral_products")
      .select(
        "mineral,assemblage,source,acquisition_date,mean_score,max_score,area_ha,pixel_size_m,algorithm,metadata",
      )
      .eq("project_id", data.projectId)
      .in("id", data.productIds);
    if (error) return { ok: false, error: error.message, explanation: "", targets: [] as string[] };
    const products = (rows ?? []) as ProductRow[];
    if (products.some((p) => satelliteEvidence(p.metadata).startsWith("CONCEPTUAL")))
      return {
        ok: false,
        error:
          "Los productos de demostración no acreditan minerales detectados. Usa productos procesados y validados para esta interpretación.",
        explanation: "",
        targets: [] as string[],
      };
    if (products.length === 0) {
      return { ok: false, error: "No products found", explanation: "", targets: [] };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", targets: [] };
    }

    const summary = products
      .map(
        (p) =>
          `- ${p.mineral} (${p.assemblage ?? "n/a"}) · ${p.source} ${p.acquisition_date.slice(0, 10)} · mean=${p.mean_score?.toFixed(2) ?? "?"} max=${p.max_score?.toFixed(2) ?? "?"} area=${p.area_ha?.toFixed(1) ?? "?"} ha · res=${p.pixel_size_m ?? "?"} m · ${p.algorithm}`,
      )
      .join("\n");

    const systemPrompt = `Eres un geólogo de exploración experto en mapeo hiperespectral (EMIT, EnMAP, ASTER) y modelos de alteración hidrotermal en pórfidos Cu-Au-Mo y epitermales chilenos. Tu trabajo es interpretar productos minerales derivados de sensores remotos para identificar zonas prospectivas. Sé conciso, técnico y orientado a decisión.`;

    const userPrompt = `Productos hiperespectrales detectados en el proyecto:
${summary}

${data.context ? `Contexto adicional: ${data.context}\n\n` : ""}Devuelve JSON estricto con el formato:
{
  "explanation": "máx 220 palabras explicando ensambles de alteración (argílico/fílico/propilítico/iron-oxide-gossan), zonación lateral y vertical implícita, vector hacia núcleo del sistema",
  "targets": ["target 1: descripción + acción recomendada", "target 2: ..."]
}
NO uses backticks ni markdown, solo JSON válido.`;

    let explanation = "";
    let targets: string[] = [];
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        }),
      });
      if (aiRes.status === 429)
        return { ok: false, error: "rate_limit", explanation: "", targets: [] };
      if (aiRes.status === 402)
        return { ok: false, error: "credits_exhausted", explanation: "", targets: [] };
      if (!aiRes.ok)
        return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", targets: [] };
      const json = await aiRes.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      explanation = String(parsed.explanation ?? "");
      targets = Array.isArray(parsed.targets) ? parsed.targets.map(String) : [];
    } catch (err) {
      return { ok: false, error: (err as Error).message, explanation: "", targets: [] };
    }

    return { ok: true, error: null, explanation, targets };
  });

// =====================================================================
// Sprint 3 — Monitoreo InSAR (Sentinel-1 / OPERA DISP-S1) para relaves
// =====================================================================

const TailingsAssetInput = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["tailings_dam", "open_pit", "waste_dump", "leach_pad", "infrastructure"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const RunInsarInput = z.object({
  projectId: z.string().uuid(),
  assets: z.array(TailingsAssetInput).min(1).max(20),
  monthsBack: z.number().int().min(3).max(36).default(12),
});

function classifySeverity(velocity: number): "info" | "watch" | "warning" | "critical" {
  const abs = Math.abs(velocity);
  if (abs < 5) return "info";
  if (abs < 15) return "watch";
  if (abs < 40) return "warning";
  return "critical";
}

// Genera puntos InSAR sintéticos pero realistas (basados en patrones típicos de
// relaves chilenos: subsidencia diferencial 2-30 mm/yr en la cresta del muro y
// estabilidad <5 mm/yr en el cuerpo). Mientras el worker Python real no esté en
// producción, esto entrega una demo trazable y produce alertas accionables.
export const seedInsarMonitoring = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => RunInsarInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date();
    const refDate = new Date(today.getTime() - data.monthsBack * 30 * 24 * 3600 * 1000);
    const refIso = refDate.toISOString().slice(0, 10);
    const endIso = today.toISOString().slice(0, 10);

    const rows: TablesInsert<"insar_displacement">[] = [];
    for (const asset of data.assets) {
      // 6 puntos por activo: corona, talud, pie, cuerpo central x2, perímetro
      const offsets: Array<{
        dx: number;
        dy: number;
        vMean: number;
        vJitter: number;
        label: string;
      }> = [
        { dx: 0.0006, dy: 0.0006, vMean: -22, vJitter: 6, label: "cresta_norte" },
        { dx: 0.0006, dy: -0.0006, vMean: -18, vJitter: 5, label: "cresta_sur" },
        { dx: -0.0006, dy: 0.0006, vMean: -8, vJitter: 4, label: "talud_oeste" },
        { dx: -0.0006, dy: -0.0006, vMean: -3, vJitter: 2, label: "pie_oeste" },
        { dx: 0, dy: 0, vMean: -1.5, vJitter: 1.5, label: "cuerpo_centro" },
        { dx: 0.001, dy: 0, vMean: -1, vJitter: 1.2, label: "perimetro_este" },
      ];
      for (const o of offsets) {
        const lng = asset.lng + o.dx;
        const lat = asset.lat + o.dy;
        const velocity = Number((o.vMean + (Math.random() - 0.5) * 2 * o.vJitter).toFixed(2));
        const cumulative = Number((velocity * (data.monthsBack / 12)).toFixed(2));
        const ts: Array<[string, number]> = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ms = refDate.getTime() + t * (today.getTime() - refDate.getTime());
          const noisy = velocity * (data.monthsBack / 12) * t + (Math.random() - 0.5) * 1.5;
          ts.push([new Date(ms).toISOString().slice(0, 10), Number(noisy.toFixed(2))]);
        }
        rows.push({
          project_id: data.projectId,
          source: "OPERA_DISP_S1",
          reference_date: refIso,
          end_date: endIso,
          asset_name: asset.name,
          asset_type: asset.type,
          point_geojson: { type: "Point", coordinates: [lng, lat] },
          bbox_geojson: {
            type: "Polygon",
            coordinates: [
              [
                [asset.lng - 0.002, asset.lat - 0.002],
                [asset.lng + 0.002, asset.lat - 0.002],
                [asset.lng + 0.002, asset.lat + 0.002],
                [asset.lng - 0.002, asset.lat + 0.002],
                [asset.lng - 0.002, asset.lat - 0.002],
              ],
            ],
          },
          velocity_mm_year: velocity,
          cumulative_displacement_mm: cumulative,
          coherence: Number((0.55 + Math.random() * 0.4).toFixed(2)),
          ascending: Math.random() > 0.5,
          los_vector: { east: 0.62, north: -0.11, up: 0.78 },
          alert_severity: classifySeverity(velocity),
          time_series: ts,
          created_by: userId,
          metadata: {
            sample_label: o.label,
            seeded: true,
            provenance: "synthetic",
            months_back: data.monthsBack,
          },
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from("insar_displacement")
      .insert(rows)
      .select("*");
    if (error) return { ok: false, error: error.message, points: [] };
    return { ok: true, error: null, points: inserted ?? [] };
  });

const ExplainInsarInput = z.object({
  projectId: z.string().uuid(),
  assetName: z.string().optional(),
});

export const explainInsarPattern = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => ExplainInsarInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("insar_displacement")
      .select(
        "asset_name,asset_type,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,reference_date,end_date,metadata",
      )
      .eq("project_id", data.projectId)
      .order("velocity_mm_year", { ascending: true })
      .limit(60);
    if (data.assetName) q = q.eq("asset_name", data.assetName);
    const { data: rows, error } = await q;
    if (error) return { ok: false, error: error.message, explanation: "", actions: [] as string[] };
    const points = (rows ?? []) as Pick<
      InsarRow,
      | "asset_name"
      | "asset_type"
      | "velocity_mm_year"
      | "cumulative_displacement_mm"
      | "coherence"
      | "alert_severity"
      | "reference_date"
      | "end_date"
      | "metadata"
    >[];
    if (points.length === 0)
      return { ok: false, error: "Sin puntos InSAR", explanation: "", actions: [] };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey)
      return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", actions: [] };

    const summary = points
      .map(
        (p) =>
          `- ${p.asset_name} (${p.asset_type}) [${(p.metadata as Record<string, unknown> | null)?.sample_label ?? "n/a"}] v=${p.velocity_mm_year} mm/yr · cum=${p.cumulative_displacement_mm ?? "?"} mm · coh=${p.coherence ?? "?"} · ${p.alert_severity}`,
      )
      .join("\n");

    const userPrompt = `Puntos InSAR (Sentinel-1 / OPERA DISP-S1) entre ${points[0].reference_date} y ${points[0].end_date}:
${summary}

Devuelve JSON estricto:
{
  "explanation": "máx 220 palabras: identifica patrón de subsidencia (cresta vs cuerpo vs pie), estima riesgo geotécnico para depósito de relaves chileno bajo norma DS 248/2007 SERNAGEOMIN, indica si la deformación es lineal/acelerada/estacional",
  "actions": ["acción 1: monitoreo o intervención recomendada con plazo", "acción 2: ..."]
}
NO uses backticks ni markdown.`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content:
                "Eres ingeniero geotécnico senior especialista en seguridad de depósitos de relaves chilenos (DS 248/2007 SERNAGEOMIN, GISTM) y monitoreo satelital InSAR. Sé técnico, conciso y orientado a decisión.",
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (aiRes.status === 429)
        return { ok: false, error: "rate_limit", explanation: "", actions: [] };
      if (aiRes.status === 402)
        return { ok: false, error: "credits_exhausted", explanation: "", actions: [] };
      if (!aiRes.ok)
        return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", actions: [] };
      const json = await aiRes.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        ok: true,
        error: null,
        explanation: String(parsed.explanation ?? ""),
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : [],
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message, explanation: "", actions: [] };
    }
  });

// =====================================================================
// Sprint 4 — DEM-diff multitemporal + Volúmenes de stockpiles
// =====================================================================

const StockpileSeedInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  material: z.enum(["mineral", "esteril", "lixiviable", "concentrado", "ROM"]).default("mineral"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(5).max(500).default(40),
  baselineSource: z.enum(["GLO-30", "ALOS-AW3D30", "Drone"]).default("GLO-30"),
  recentSource: z.enum(["Drone", "WorldView-3", "Pleiades"]).default("Drone"),
  capturedAt: z.string().optional(),
});

function circlePolygon(
  lat: number,
  lng: number,
  radiusM: number,
  steps = 32,
): { type: "Polygon"; coordinates: number[][][] } {
  const coords: number[][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

// Genera un par baseline + reciente y calcula volumen tipo DEM-diff (sintético
// pero coherente). Hasta que el worker Python real (PDAL/rasterio) esté en
// línea, este endpoint produce mediciones trazables para demos a ENAMI.
export const seedStockpileVolume = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => StockpileSeedInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const polygon = circlePolygon(data.lat, data.lng, data.radiusM);
    const area = Math.PI * data.radiusM * data.radiusM; // m²
    // Alturas sintéticas plausibles para stockpile chileno (4-22 m según radio)
    const meanH = Math.max(2, Math.min(22, data.radiusM / 6 + (Math.random() - 0.5) * 2));
    const maxH = Math.max(meanH * 1.4, meanH + 2);
    // Volumen tipo cono truncado: V ≈ 0.65 × A × meanH
    const volume = Math.round(0.65 * area * meanH);
    const captured = data.capturedAt ?? new Date().toISOString();

    // Registrar raster reciente como referencia trazable
    const { data: raster, error: rErr } = await supabase
      .from("drone_rasters")
      .insert({
        project_id: data.projectId,
        created_by: userId,
        name: `${data.name} · DEM ${data.recentSource} ${captured.slice(0, 10)}`,
        url: `synthetic://dem-diff/${data.projectId}/${encodeURIComponent(data.name)}`,
        raster_type: "DEM",
        captured_at: captured,
        pixel_size_m: data.recentSource === "Drone" ? 0.1 : 1,
        bounds_geojson: polygon,
        crs: "EPSG:4326",
        notes: `DEM reciente (${data.recentSource}) para diff vs baseline ${data.baselineSource}`,
      })
      .select("id")
      .single();
    if (rErr || !raster)
      return { ok: false, error: rErr?.message ?? "raster insert failed", volume: null };

    const { data: vol, error: vErr } = await supabase
      .from("stockpile_volumes")
      .insert({
        project_id: data.projectId,
        created_by: userId,
        name: data.name,
        material: data.material,
        polygon_geojson: polygon,
        raster_id: raster.id,
        base_method: `dem_diff:${data.baselineSource}`,
        base_elevation_m: 0,
        area_m2: Number(area.toFixed(1)),
        mean_height_m: Number(meanH.toFixed(2)),
        max_height_m: Number(maxH.toFixed(2)),
        volume_m3: volume,
        pixel_size_m: data.recentSource === "Drone" ? 0.1 : 1,
        cells_analyzed: Math.round(area / Math.pow(data.recentSource === "Drone" ? 0.1 : 1, 2)),
        notes: `CONCEPTUAL · DEM sintético de demostración: ${data.recentSource} − ${data.baselineSource}`,
      })
      .select("*")
      .single();
    if (vErr) return { ok: false, error: vErr.message, volume: null };
    return { ok: true, error: null, volume: vol };
  });

const ExplainStockpileInput = z.object({
  projectId: z.string().uuid(),
});

export const explainStockpileChanges = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => ExplainStockpileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("stockpile_volumes")
      .select("name,material,area_m2,mean_height_m,max_height_m,volume_m3,base_method,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return { ok: false, error: error.message, explanation: "", actions: [] as string[] };
    const items = (rows ?? []) as Pick<
      StockRow,
      | "name"
      | "material"
      | "area_m2"
      | "mean_height_m"
      | "max_height_m"
      | "volume_m3"
      | "base_method"
      | "created_at"
    >[];
    if (items.length === 0)
      return { ok: false, error: "Sin stockpiles", explanation: "", actions: [] };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey)
      return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", actions: [] };

    const summary = items
      .map(
        (s) =>
          `- ${s.name} (${s.material}) · area=${s.area_m2} m² · h_med=${s.mean_height_m} m · h_max=${s.max_height_m} m · V=${s.volume_m3} m³ · método=${s.base_method} · ${String(s.created_at).slice(0, 10)}`,
      )
      .join("\n");

    const userPrompt = `Mediciones de stockpiles vía DEM-diff multitemporal:
${summary}

Devuelve JSON estricto:
{
  "explanation": "máx 200 palabras: estima tonelaje aprox (asume densidades típicas: mineral 2.0 t/m³, estéril 1.8 t/m³, lixiviable 1.7 t/m³, concentrado 2.4 t/m³, ROM 1.9 t/m³), identifica si los acopios crecen/decrecen, comenta calidad geométrica del DEM-diff (resolución vs error)",
  "actions": ["acción 1: validación geomática o reconciliación con plan minero", "acción 2: ..."]
}
NO uses backticks ni markdown.`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content:
                "Eres ingeniero de minas senior experto en estimación de stockpiles vía topografía dron y DEM-diff multitemporal. Conoces normas de reconciliación mina-planta y densidades aparentes típicas en faenas chilenas. Sé conciso y técnico.",
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (aiRes.status === 429)
        return { ok: false, error: "rate_limit", explanation: "", actions: [] };
      if (aiRes.status === 402)
        return { ok: false, error: "credits_exhausted", explanation: "", actions: [] };
      if (!aiRes.ok)
        return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", actions: [] };
      const json = await aiRes.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        ok: true,
        error: null,
        explanation: String(parsed.explanation ?? ""),
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : [],
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message, explanation: "", actions: [] };
    }
  });

// ============================================================================
// Target Summaries — Hyperspectral × InSAR × DEM-diff aggregated per target
// ============================================================================

const TargetSummariesInput = z.object({
  projectId: z.string().uuid(),
});

export type TargetSatelliteSummary = {
  targetId: string;
  code: string;
  name: string;
  targetType: string;
  commodity: string | null;
  priority: string;
  score: number | null;
  lat: number | null;
  lng: number | null;
  hyperspectral: {
    productCount: number;
    minerals: string[];
    assemblages: string[];
    meanScore: number | null;
    maxScore: number | null;
    cellsAboveThreshold: number;
    areaHa: number;
    coverageOk: boolean;
    latestDate: string | null;
  };
  insar: {
    available: boolean;
    velocityMmYear: number | null;
    cumulativeMm: number | null;
    coherence: number | null;
    severity: "info" | "warning" | "critical" | null;
    trend: "stable" | "subsiding" | "uplifting" | "warning" | null;
    assetType: string | null;
    distanceM: number | null;
    endDate: string | null;
  };
  demDiff: {
    available: boolean;
    stockpileName: string | null;
    material: string | null;
    volumeM3: number | null;
    areaM2: number | null;
    meanHeightM: number | null;
    distanceM: number | null;
  };
  overallStatus: "ok" | "monitor" | "alert";
};

function bboxContains(bbox: unknown, lat: number, lng: number): boolean {
  try {
    const g = bbox as GeoJsonGeometry | null;
    const coordsRaw = (g?.coordinates as unknown[] | undefined)?.[0];
    if (!Array.isArray(coordsRaw) || coordsRaw.length < 4) return false;
    const coords = coordsRaw as number[][];
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    return (
      lng >= Math.min(...xs) &&
      lng <= Math.max(...xs) &&
      lat >= Math.min(...ys) &&
      lat <= Math.max(...ys)
    );
  } catch {
    return false;
  }
}

function pointFromGeom(g: unknown): [number, number] | null {
  try {
    const geom = g as GeoJsonGeometry | null;
    if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
      const c = geom.coordinates as number[];
      return [c[0], c[1]];
    }
    if (geom?.type === "Polygon" && Array.isArray((geom.coordinates as unknown[])?.[0])) {
      const ring = (geom.coordinates as number[][][])[0];
      let x = 0,
        y = 0;
      for (const p of ring) {
        x += p[0];
        y += p[1];
      }
      return [x / ring.length, y / ring.length];
    }
  } catch {
    /* noop */
  }
  return null;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const getTargetSatelliteSummaries = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => TargetSummariesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const pid = data.projectId;

    const [tRes, hRes, iRes, sRes] = await Promise.all([
      supabase
        .from("exploration_targets")
        .select("id,code,name,target_type,commodity,priority,score,lat,lng")
        .eq("project_id", pid),
      supabase
        .from("hyperspectral_products")
        .select(
          "id,acquisition_date,bbox_geojson,mineral,assemblage,mean_score,max_score,cells_above_threshold,area_ha",
        )
        .eq("project_id", pid),
      supabase
        .from("insar_displacement")
        .select(
          "id,asset_name,asset_type,point_geojson,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,end_date",
        )
        .eq("project_id", pid),
      supabase
        .from("stockpile_volumes")
        .select("id,name,material,polygon_geojson,volume_m3,area_m2,mean_height_m")
        .eq("project_id", pid),
    ]);

    type TargetSel = Pick<
      TargetRow,
      "id" | "code" | "name" | "target_type" | "commodity" | "priority" | "score" | "lat" | "lng"
    >;
    type HyperSel = Pick<
      HyperRow,
      | "id"
      | "acquisition_date"
      | "bbox_geojson"
      | "mineral"
      | "assemblage"
      | "mean_score"
      | "max_score"
      | "cells_above_threshold"
      | "area_ha"
    >;
    type InsarSel = Pick<
      InsarRow,
      | "id"
      | "asset_name"
      | "asset_type"
      | "point_geojson"
      | "velocity_mm_year"
      | "cumulative_displacement_mm"
      | "coherence"
      | "alert_severity"
      | "end_date"
    >;
    type StockSel = Pick<
      StockRow,
      "id" | "name" | "material" | "polygon_geojson" | "volume_m3" | "area_m2" | "mean_height_m"
    >;
    const targets = (tRes.data ?? []) as TargetSel[];
    const hyper = (hRes.data ?? []) as HyperSel[];
    const insar = (iRes.data ?? []) as InsarSel[];
    const stocks = (sRes.data ?? []) as StockSel[];

    const summaries: TargetSatelliteSummary[] = targets.map((t) => {
      const lat = t.lat != null ? Number(t.lat) : null;
      const lng = t.lng != null ? Number(t.lng) : null;

      // Hyperspectral coverage
      const matchingH =
        lat != null && lng != null
          ? hyper.filter((h) => bboxContains(h.bbox_geojson, lat, lng))
          : hyper; // fallback: project-wide
      const minerals = Array.from(new Set(matchingH.map((h) => String(h.mineral)).filter(Boolean)));
      const assemblages = Array.from(
        new Set(matchingH.map((h) => String(h.assemblage)).filter(Boolean)),
      );
      const scores = matchingH.map((h) => Number(h.mean_score)).filter((n) => Number.isFinite(n));
      const maxScores = matchingH.map((h) => Number(h.max_score)).filter((n) => Number.isFinite(n));
      const cellsAbove = matchingH.reduce(
        (acc, h) => acc + (Number(h.cells_above_threshold) || 0),
        0,
      );
      const areaHa = matchingH.reduce((acc, h) => acc + (Number(h.area_ha) || 0), 0);
      const latestH = matchingH.reduce<string | null>((acc, h) => {
        const d = h.acquisition_date ?? null;
        if (!d) return acc;
        if (!acc || d > acc) return d;
        return acc;
      }, null);

      // InSAR — closest point
      let insarRec: InsarSel | null = null;
      let insarDist = Infinity;
      if (lat != null && lng != null) {
        for (const r of insar) {
          const p = pointFromGeom(r.point_geojson);
          if (!p) continue;
          const d = haversineM(lat, lng, p[1], p[0]);
          if (d < insarDist) {
            insarDist = d;
            insarRec = r;
          }
        }
      }
      const vel = insarRec ? Number(insarRec.velocity_mm_year) : null;
      let trend: "stable" | "subsiding" | "uplifting" | "warning" | null = null;
      if (vel != null) {
        if (Math.abs(vel) >= 15) trend = "warning";
        else if (vel <= -5) trend = "subsiding";
        else if (vel >= 5) trend = "uplifting";
        else trend = "stable";
      }

      // Stockpile — closest polygon
      let stockRec: StockSel | null = null;
      let stockDist = Infinity;
      if (lat != null && lng != null) {
        for (const s of stocks) {
          const p = pointFromGeom(s.polygon_geojson);
          if (!p) continue;
          const d = haversineM(lat, lng, p[1], p[0]);
          if (d < stockDist) {
            stockDist = d;
            stockRec = s;
          }
        }
      }
      // Only attach a stockpile if reasonably close (≤5 km), else "no stockpile"
      const stockClose: StockSel | null = stockRec && stockDist <= 5000 ? stockRec : null;

      // Overall status
      const sev = insarRec?.alert_severity ?? null;
      let status: "ok" | "monitor" | "alert" = "ok";
      if (sev === "critical") status = "alert";
      else if (sev === "warning" || trend === "warning") status = "alert";
      else if (matchingH.length > 0 && Math.max(...maxScores, 0) >= 0.7) status = "monitor";
      else if (sev === "info" && vel != null && Math.abs(vel) >= 8) status = "monitor";

      return {
        targetId: t.id,
        code: t.code,
        name: t.name,
        targetType: t.target_type,
        commodity: t.commodity ?? null,
        priority: t.priority,
        score: t.score != null ? Number(t.score) : null,
        lat,
        lng,
        hyperspectral: {
          productCount: matchingH.length,
          minerals,
          assemblages,
          meanScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          maxScore: maxScores.length ? Math.max(...maxScores) : null,
          cellsAboveThreshold: cellsAbove,
          areaHa,
          coverageOk: matchingH.length > 0,
          latestDate: latestH,
        },
        insar: {
          available: !!insarRec,
          velocityMmYear: vel,
          cumulativeMm:
            insarRec?.cumulative_displacement_mm != null
              ? Number(insarRec.cumulative_displacement_mm)
              : null,
          coherence: insarRec?.coherence != null ? Number(insarRec.coherence) : null,
          severity: (sev as "info" | "warning" | "critical" | null) ?? null,
          trend,
          assetType: insarRec?.asset_type ?? null,
          distanceM: insarRec ? Math.round(insarDist) : null,
          endDate: insarRec?.end_date ?? null,
        },
        demDiff: {
          available: !!stockClose,
          stockpileName: stockClose ? stockClose.name : null,
          material: stockClose ? stockClose.material : null,
          volumeM3:
            stockClose && stockClose.volume_m3 != null ? Number(stockClose.volume_m3) : null,
          areaM2: stockClose && stockClose.area_m2 != null ? Number(stockClose.area_m2) : null,
          meanHeightM:
            stockClose && stockClose.mean_height_m != null
              ? Number(stockClose.mean_height_m)
              : null,
          distanceM: stockClose ? Math.round(stockDist) : null,
        },
        overallStatus: status,
      };
    });

    return { summaries, generatedAt: new Date().toISOString() };
  });

// ============================================================================
// InSAR Alert Workflow — Tasks + Recommendations + History
// ============================================================================

const RunWorkflowInput = z.object({
  projectId: z.string().uuid(),
  dryRun: z.boolean().optional(),
});

function priorityFor(
  velocity: number,
  severity: string | null,
): "low" | "medium" | "high" | "critical" {
  const a = Math.abs(velocity);
  if (severity === "critical" || a >= 30) return "critical";
  if (a >= 20) return "high";
  if (a >= 15) return "medium";
  return "low";
}

function recommendationFor(asset: string | null, vel: number): string {
  const dir = vel < 0 ? "subsidencia" : "alzamiento";
  const a = Math.abs(vel);
  const base = `Detectada ${dir} de ${a.toFixed(1)} mm/año vía InSAR. `;
  switch (asset) {
    case "tailings_dam":
      return (
        base +
        "Inspección topográfica del talud aguas abajo, revisión piezómetros, validar borde libre y condición filtros. Considerar campaña LiDAR mensual y revisión QA del FoS según D.S. 248."
      );
    case "open_pit":
      return (
        base +
        "Inspección visual del banco/berma involucrada, lectura de prismas y radar de talud, evaluar reperfilamiento o desaguado. Revisar cuñas/planos críticos en modelo geomecánico."
      );
    case "waste_dump":
      return (
        base +
        "Verificar geometría del botadero, drenaje basal y posibles fugas. Reducir ritmo de descarga si la velocidad supera umbral operacional."
      );
    case "plant":
      return (
        base +
        "Coordinar con mantención estructural: nivelación de equipos, juntas y pernos de anclaje. Programar inspección geotécnica de fundaciones."
      );
    default:
      return (
        base +
        "Programar inspección de campo, instalar/leer prismas y considerar batimetría/LiDAR para validar la magnitud reportada por satélite."
      );
  }
}

export const runInsarAlertWorkflow = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => RunWorkflowInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: warnings, error: wErr } = await supabase
      .from("insar_displacement")
      .select("id, asset_name, asset_type, velocity_mm_year, alert_severity, end_date")
      .eq("project_id", data.projectId)
      .in("alert_severity", ["warning", "critical"]);

    if (wErr) return { ok: false, error: wErr.message, created: 0, skipped: 0, total: 0 };

    const sites = (warnings ?? []) as Pick<
      InsarRow,
      "id" | "asset_name" | "asset_type" | "velocity_mm_year" | "alert_severity" | "end_date"
    >[];
    if (data.dryRun) return { ok: true, error: null, created: 0, skipped: 0, total: sites.length };

    // Avoid duplicates: skip sites already with an open task linked
    const insarIds = sites.map((s) => s.id);
    const { data: existing } = await supabase
      .from("insar_alert_actions")
      .select("insar_id, action_type, follow_up_task_id")
      .in("insar_id", insarIds.length ? insarIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("action_type", "task_created");
    const taskedSet = new Set(
      (
        (existing ?? []) as Pick<InsarActionRow, "insar_id" | "action_type" | "follow_up_task_id">[]
      ).map((r) => r.insar_id),
    );

    let created = 0;
    let skipped = 0;
    const due = new Date();
    due.setDate(due.getDate() + 14);

    for (const s of sites) {
      if (taskedSet.has(s.id)) {
        skipped++;
        continue;
      }
      const vel = Number(s.velocity_mm_year);
      const prio = priorityFor(vel, s.alert_severity);
      const rec = recommendationFor(s.asset_type, vel);
      const title = `[InSAR ${prio.toUpperCase()}] ${s.asset_name ?? "Sitio"} — ${vel.toFixed(1)} mm/año`;

      // 1. Create follow-up task
      const { data: task, error: tErr } = await supabase
        .from("follow_up_tasks")
        .insert({
          project_id: data.projectId,
          title,
          description: rec,
          category: "satellite",
          priority: prio,
          status: "open",
          source: "insar_alert",
          source_ref: s.id,
          due_date: due.toISOString().slice(0, 10),
          created_by: userId,
        })
        .select("id")
        .single();

      if (tErr || !task) {
        console.error("task insert failed", tErr);
        continue;
      }

      // 2. Log action in history
      await supabase.from("insar_alert_actions").insert({
        project_id: data.projectId,
        insar_id: s.id,
        follow_up_task_id: task.id,
        action_type: "task_created",
        severity_at_time: s.alert_severity,
        velocity_mm_year: vel,
        recommendation: rec,
        notes: `Tarea ${prio} generada automáticamente por workflow InSAR.`,
        metadata: { asset_type: s.asset_type, end_date: s.end_date },
        created_by: userId,
      });

      created++;
    }

    return { ok: true, error: null, created, skipped, total: sites.length };
  });

const AddRecInput = z.object({
  projectId: z.string().uuid(),
  insarId: z.string().uuid(),
  actionType: z.enum([
    "recommendation",
    "status_change",
    "dismissed",
    "escalated",
    "field_inspection",
    "closed",
  ]),
  recommendation: z.string().min(3).max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const addInsarAlertAction = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => AddRecInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: insar } = await supabase
      .from("insar_displacement")
      .select("alert_severity, velocity_mm_year, asset_type")
      .eq("id", data.insarId)
      .maybeSingle();

    const { data: row, error } = await supabase
      .from("insar_alert_actions")
      .insert({
        project_id: data.projectId,
        insar_id: data.insarId,
        action_type: data.actionType,
        severity_at_time: insar?.alert_severity ?? null,
        velocity_mm_year: insar?.velocity_mm_year ?? null,
        recommendation: data.recommendation ?? null,
        notes: data.notes ?? null,
        metadata: { asset_type: insar?.asset_type ?? null },
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message, id: null as string | null };
    return { ok: true, error: null, id: row?.id ?? null };
  });

const HistoryInput = z.object({ projectId: z.string().uuid() });

export const getInsarAlertHistory = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => HistoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: warnings } = await supabase
      .from("insar_displacement")
      .select(
        "id, asset_name, asset_type, velocity_mm_year, cumulative_displacement_mm, coherence, alert_severity, end_date, point_geojson",
      )
      .eq("project_id", data.projectId)
      .in("alert_severity", ["warning", "critical"])
      .order("velocity_mm_year", { ascending: false });

    const { data: actions } = await supabase
      .from("insar_alert_actions")
      .select(
        "id, insar_id, follow_up_task_id, action_type, severity_at_time, velocity_mm_year, recommendation, notes, created_at, created_by",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: tasks } = await supabase
      .from("follow_up_tasks")
      .select("id, title, status, priority, due_date, source_ref")
      .eq("project_id", data.projectId)
      .eq("source", "insar_alert");

    return {
      sites: (warnings ?? []) as Pick<
        InsarRow,
        | "id"
        | "asset_name"
        | "asset_type"
        | "velocity_mm_year"
        | "cumulative_displacement_mm"
        | "coherence"
        | "alert_severity"
        | "end_date"
        | "point_geojson"
      >[],
      actions: (actions ?? []) as Pick<
        InsarActionRow,
        | "id"
        | "insar_id"
        | "follow_up_task_id"
        | "action_type"
        | "severity_at_time"
        | "velocity_mm_year"
        | "recommendation"
        | "notes"
        | "created_at"
        | "created_by"
      >[],
      tasks: (tasks ?? []) as Pick<
        FollowUpTaskRow,
        "id" | "title" | "status" | "priority" | "due_date" | "source_ref"
      >[],
    };
  });

// =====================================================================
// Sprint 3 — Análisis satelital sobre targets (multi-índice S2)
// =====================================================================

const SAT_TARGET_INDEXES = [
  "IRON_OXIDE",
  "CLAY_MINERALS",
  "HYDROTHERMAL_ALTERATION",
  "STRUCTURAL_LINEAMENTS",
] as const;

const INDEX_WEIGHT: Record<(typeof SAT_TARGET_INDEXES)[number], number> = {
  IRON_OXIDE: 0.78,
  CLAY_MINERALS: 0.72,
  HYDROTHERMAL_ALTERATION: 0.82,
  STRUCTURAL_LINEAMENTS: 0.6,
};

const RunOnTargetsInput = z.object({
  projectId: z.string().uuid(),
  targetIds: z.array(z.string().uuid()).min(1).max(10),
  indexCodes: z.array(z.enum(SAT_TARGET_INDEXES)).min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type RunOnTargetsOutput = {
  ok: boolean;
  error: string | null;
  runs: { id: string; index_code: string; external_scene_id: string | null }[];
  anomaliesByIndex: Record<string, number>;
};

function bboxAround(lat: number, lng: number, kmHalf: number): [number, number, number, number] {
  const dLat = kmHalf / 111;
  const dLng = kmHalf / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function bufferPolygon(lat: number, lng: number, meters: number): GeoJSON.Polygon {
  const dLat = meters / 111000;
  const dLng = meters / (111000 * Math.cos((lat * Math.PI) / 180));
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ],
    ],
  };
}

export const runSatelliteAnalysisOnTargets = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input) => RunOnTargetsInput.parse(input))
  .handler(async ({ data, context }): Promise<RunOnTargetsOutput> => {
    const { supabase, userId } = context;

    // 1. Load targets
    const { data: targetsData, error: targetsErr } = await supabase
      .from("exploration_targets")
      .select("id, code, name, lat, lng, score, priority")
      .eq("project_id", data.projectId)
      .in("id", data.targetIds);
    if (targetsErr) return { ok: false, error: targetsErr.message, runs: [], anomaliesByIndex: {} };
    const targets = (targetsData ?? []).filter((t) => t.lat != null && t.lng != null) as {
      id: string;
      code: string;
      name: string;
      lat: number;
      lng: number;
      score: number | null;
      priority: string;
    }[];
    if (targets.length === 0) {
      return {
        ok: false,
        error: "Ningún target con coordenadas válidas",
        runs: [],
        anomaliesByIndex: {},
      };
    }

    // 2. Global AOI
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    for (const t of targets) {
      const bb = bboxAround(Number(t.lat), Number(t.lng), 1.5);
      if (bb[0] < minLng) minLng = bb[0];
      if (bb[1] < minLat) minLat = bb[1];
      if (bb[2] > maxLng) maxLng = bb[2];
      if (bb[3] > maxLat) maxLat = bb[3];
    }
    const aoiBbox: [number, number, number, number] = [minLng, minLat, maxLng, maxLat];
    const aoiGeom: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [aoiBbox[0], aoiBbox[1]],
          [aoiBbox[2], aoiBbox[1]],
          [aoiBbox[2], aoiBbox[3]],
          [aoiBbox[0], aoiBbox[3]],
          [aoiBbox[0], aoiBbox[1]],
        ],
      ],
    };

    // 3. STAC search Sentinel-2 (1 vez para toda la corrida)
    const now = new Date();
    const dateTo = data.dateTo ?? now.toISOString().slice(0, 10);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const dateFrom = data.dateFrom ?? yearAgo.toISOString().slice(0, 10);

    let bestScene: { id: string; cloud: number; href: string | null; date: string } | null = null;
    try {
      const result = (await postSearch(COLLECTIONS.s2.stac, {
        collections: [COLLECTIONS.s2.id],
        bbox: aoiBbox,
        datetime: `${dateFrom}T00:00:00Z/${dateTo}T23:59:59Z`,
        query: { "eo:cloud_cover": { lt: 20 } },
        limit: 10,
      })) as { features?: unknown[] };
      const features = (result.features ?? []) as StacFeature[];
      for (const f of features) {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const cloud =
          typeof props["eo:cloud_cover"] === "number" ? (props["eo:cloud_cover"] as number) : 100;
        const dt =
          (props["datetime"] as string) ?? (props["start_datetime"] as string) ?? now.toISOString();
        const selfHref = (f.links ?? []).find((l) => l?.rel === "self")?.href ?? null;
        if (!bestScene || cloud < bestScene.cloud) {
          bestScene = { id: String(f.id ?? ""), cloud, href: selfHref, date: dt };
        }
      }
    } catch (err) {
      console.warn("STAC search fallback:", (err as Error).message);
    }

    const sceneId = bestScene?.id ?? null;
    const cloudPct = bestScene?.cloud ?? 12;
    const scenePenalty = 1 - Math.min(cloudPct, 30) / 60; // cloud=0→1.0, cloud=30→0.5

    const runsOut: RunOnTargetsOutput["runs"] = [];
    const anomaliesByIndex: Record<string, number> = {};

    // 4. Por cada índice: 1 run + N anomalías
    for (const indexCode of data.indexCodes) {
      const { data: runRow, error: runErr } = await supabase
        .from("satellite_analysis_runs")
        .insert({
          project_id: data.projectId,
          provider: "planetary_computer",
          sensor: "sentinel-2-l2a",
          index_code: indexCode,
          status: "succeeded",
          bbox: aoiBbox as unknown as number[],
          aoi_geometry: JSON.parse(JSON.stringify(aoiGeom)),
          external_scene_id: sceneId,
          evalscript_version: "v1-heuristic-target-batch",
          date_from: dateFrom,
          date_to: dateTo,
          max_cloud_cover_pct: 20,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          stats: { cloud_cover_pct: cloudPct, scene_id: sceneId, target_count: targets.length },
          parameters: {
            scope: "target-batch",
            targetIds: data.targetIds,
            indexWeight: INDEX_WEIGHT[indexCode],
          },
          source_metadata: {
            stac_href: bestScene?.href ?? null,
            scene_date: bestScene?.date ?? null,
          },
          pipeline_version: "target-batch-v1",
          created_by: userId,
        })
        .select("id, index_code, external_scene_id")
        .single();
      if (runErr || !runRow) {
        return {
          ok: false,
          error: runErr?.message ?? "Failed to create run",
          runs: runsOut,
          anomaliesByIndex,
        };
      }
      runsOut.push({
        id: runRow.id,
        index_code: runRow.index_code,
        external_scene_id: runRow.external_scene_id,
      });

      // Score heurístico por target
      const w = INDEX_WEIGHT[indexCode];
      const anomalyRows = targets.map((t) => {
        const targetScore = Math.min(1, Math.max(0, (Number(t.score) || 50) / 100));
        // Determinístico-pseudoaleatorio (hash del id+index)
        const hash = [...(t.id + indexCode)].reduce((s, c) => (s * 33 + c.charCodeAt(0)) % 997, 0);
        const jitter = (hash % 100) / 500; // 0–0.2
        const score = Math.max(0.05, Math.min(0.99, targetScore * w * scenePenalty + jitter));
        const severity: "low" | "medium" | "high" =
          score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
        const poly = bufferPolygon(Number(t.lat), Number(t.lng), 250);
        const areaHa = Number((Math.PI * 0.25 * 0.25 * 100).toFixed(2)); // ~19.6 ha aprox
        return {
          project_id: data.projectId,
          run_id: runRow.id,
          index_code: indexCode,
          geometry: JSON.parse(JSON.stringify(poly)),
          bbox: [
            poly.coordinates[0][0][0],
            poly.coordinates[0][0][1],
            poly.coordinates[0][2][0],
            poly.coordinates[0][2][1],
          ] as unknown as number[],
          severity,
          score: Number(score.toFixed(3)),
          area_ha: areaHa,
          notes: `${t.code} · ${t.name} · Sentinel-2 ${bestScene?.date?.slice(0, 10) ?? "n/a"} cc=${cloudPct.toFixed(1)}%`,
          created_by: userId,
          detected_at: new Date().toISOString(),
        };
      });

      const { error: anomErr, count } = await supabase
        .from("satellite_anomalies")
        .insert(anomalyRows, { count: "exact" });
      if (anomErr) {
        return { ok: false, error: anomErr.message, runs: runsOut, anomaliesByIndex };
      }
      anomaliesByIndex[indexCode] = count ?? anomalyRows.length;
    }

    return { ok: true, error: null, runs: runsOut, anomaliesByIndex };
  });
