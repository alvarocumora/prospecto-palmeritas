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

function normalizeFeature(f: any, collection: string): StacItem {
  const props = (f?.properties ?? {}) as Record<string, unknown>;
  const assets = (f?.assets ?? {}) as Record<string, { href?: string; type?: string; title?: string }>;
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
    assetsJson: JSON.stringify(assets),
    propertiesJson: JSON.stringify(props),
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
        assets: JSON.parse(it.assetsJson),
        properties: JSON.parse(it.propertiesJson),
      }));
      const { error } = await (supabase.from("stac_acquisitions") as any)
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
    const { data: inserted, error } = await (supabase.from("hyperspectral_products") as any)
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
};

export const explainHyperspectralProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExplainInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase.from("hyperspectral_products") as any)
      .select("mineral,assemblage,source,acquisition_date,mean_score,max_score,area_ha,pixel_size_m,algorithm")
      .eq("project_id", data.projectId)
      .in("id", data.productIds);
    if (error) return { ok: false, error: error.message, explanation: "", targets: [] as string[] };
    const products = (rows ?? []) as ProductRow[];
    if (products.length === 0) {
      return { ok: false, error: "No products found", explanation: "", targets: [] };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", targets: [] };
    }

    const summary = products.map((p) =>
      `- ${p.mineral} (${p.assemblage ?? "n/a"}) · ${p.source} ${p.acquisition_date.slice(0,10)} · mean=${p.mean_score?.toFixed(2) ?? "?"} max=${p.max_score?.toFixed(2) ?? "?"} area=${p.area_ha?.toFixed(1) ?? "?"} ha · res=${p.pixel_size_m ?? "?"} m · ${p.algorithm}`
    ).join("\n");

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
      if (aiRes.status === 429) return { ok: false, error: "rate_limit", explanation: "", targets: [] };
      if (aiRes.status === 402) return { ok: false, error: "credits_exhausted", explanation: "", targets: [] };
      if (!aiRes.ok) return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", targets: [] };
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunInsarInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date();
    const refDate = new Date(today.getTime() - data.monthsBack * 30 * 24 * 3600 * 1000);
    const refIso = refDate.toISOString().slice(0, 10);
    const endIso = today.toISOString().slice(0, 10);

    const rows: any[] = [];
    for (const asset of data.assets) {
      // 6 puntos por activo: corona, talud, pie, cuerpo central x2, perímetro
      const offsets: Array<{ dx: number; dy: number; vMean: number; vJitter: number; label: string }> = [
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
            coordinates: [[
              [asset.lng - 0.002, asset.lat - 0.002],
              [asset.lng + 0.002, asset.lat - 0.002],
              [asset.lng + 0.002, asset.lat + 0.002],
              [asset.lng - 0.002, asset.lat + 0.002],
              [asset.lng - 0.002, asset.lat - 0.002],
            ]],
          },
          velocity_mm_year: velocity,
          cumulative_displacement_mm: cumulative,
          coherence: Number((0.55 + Math.random() * 0.4).toFixed(2)),
          ascending: Math.random() > 0.5,
          los_vector: { east: 0.62, north: -0.11, up: 0.78 },
          alert_severity: classifySeverity(velocity),
          time_series: ts,
          created_by: userId,
          metadata: { sample_label: o.label, seeded: true, months_back: data.monthsBack },
        });
      }
    }

    const { data: inserted, error } = await (supabase.from("insar_displacement") as any)
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExplainInsarInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = (supabase.from("insar_displacement") as any)
      .select("asset_name,asset_type,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,reference_date,end_date,metadata")
      .eq("project_id", data.projectId)
      .order("velocity_mm_year", { ascending: true })
      .limit(60);
    if (data.assetName) q = q.eq("asset_name", data.assetName);
    const { data: rows, error } = await q;
    if (error) return { ok: false, error: error.message, explanation: "", actions: [] as string[] };
    const points = (rows ?? []) as any[];
    if (points.length === 0) return { ok: false, error: "Sin puntos InSAR", explanation: "", actions: [] };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", actions: [] };

    const summary = points.map((p) =>
      `- ${p.asset_name} (${p.asset_type}) [${p.metadata?.sample_label ?? "n/a"}] v=${p.velocity_mm_year} mm/yr · cum=${p.cumulative_displacement_mm ?? "?"} mm · coh=${p.coherence ?? "?"} · ${p.alert_severity}`
    ).join("\n");

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
            { role: "system", content: "Eres ingeniero geotécnico senior especialista en seguridad de depósitos de relaves chilenos (DS 248/2007 SERNAGEOMIN, GISTM) y monitoreo satelital InSAR. Sé técnico, conciso y orientado a decisión." },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (aiRes.status === 429) return { ok: false, error: "rate_limit", explanation: "", actions: [] };
      if (aiRes.status === 402) return { ok: false, error: "credits_exhausted", explanation: "", actions: [] };
      if (!aiRes.ok) return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", actions: [] };
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

function circlePolygon(lat: number, lng: number, radiusM: number, steps = 32): { type: "Polygon"; coordinates: number[][][] } {
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
  .middleware([requireSupabaseAuth])
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
    const { data: raster, error: rErr } = await (supabase.from("drone_rasters") as any)
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
    if (rErr || !raster) return { ok: false, error: rErr?.message ?? "raster insert failed", volume: null };

    const { data: vol, error: vErr } = await (supabase.from("stockpile_volumes") as any)
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
        notes: `DEM-diff ${data.recentSource} − ${data.baselineSource}`,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExplainStockpileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase.from("stockpile_volumes") as any)
      .select("name,material,area_m2,mean_height_m,max_height_m,volume_m3,base_method,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return { ok: false, error: error.message, explanation: "", actions: [] as string[] };
    const items = (rows ?? []) as any[];
    if (items.length === 0) return { ok: false, error: "Sin stockpiles", explanation: "", actions: [] };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY not configured", explanation: "", actions: [] };

    const summary = items.map((s) =>
      `- ${s.name} (${s.material}) · area=${s.area_m2} m² · h_med=${s.mean_height_m} m · h_max=${s.max_height_m} m · V=${s.volume_m3} m³ · método=${s.base_method} · ${String(s.created_at).slice(0, 10)}`
    ).join("\n");

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
            { role: "system", content: "Eres ingeniero de minas senior experto en estimación de stockpiles vía topografía dron y DEM-diff multitemporal. Conoces normas de reconciliación mina-planta y densidades aparentes típicas en faenas chilenas. Sé conciso y técnico." },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (aiRes.status === 429) return { ok: false, error: "rate_limit", explanation: "", actions: [] };
      if (aiRes.status === 402) return { ok: false, error: "credits_exhausted", explanation: "", actions: [] };
      if (!aiRes.ok) return { ok: false, error: `AI gateway ${aiRes.status}`, explanation: "", actions: [] };
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
