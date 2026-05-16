// Borrador automático NI 43-101 a partir de los productos satelitales y geológicos cargados.
// Devuelve un payload estructurado (no HTML) que se renderiza en cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DraftHyperRow = {
  source: string;
  mineral: string;
  assemblage: string | null;
  meanScore: number | null;
  maxScore: number | null;
  areaHa: number | null;
  cellsAboveThreshold: number | null;
  acquisitionDate: string;
};

export type DraftInsarRow = {
  assetName: string;
  assetType: string | null;
  source: string;
  alertSeverity: string | null;
  velocityMmYear: number;
  cumulativeMm: number | null;
  coherence: number | null;
  referenceDate: string;
  endDate: string;
};

export type DraftTargetRow = {
  code: string;
  name: string;
  targetType: string;
  commodity: string | null;
  priority: string;
  score: number | null;
  lat: number | null;
  lng: number | null;
  stage: string;
};

export type DraftStockpileRow = {
  name: string;
  material: string | null;
  volumeM3: number | null;
  areaM2: number | null;
  meanHeightM: number | null;
};

export type Ni43101Draft = {
  generatedAt: string;
  project: {
    id: string;
    code: string;
    name: string;
    commodity: string | null;
    country: string | null;
    region: string | null;
    centerLat: number | null;
    centerLng: number | null;
    description: string | null;
    crsEpsg: number;
  };
  stats: {
    totalTargets: number;
    totalHyperspectral: number;
    totalInsar: number;
    insarWarning: number;
    insarInfo: number;
    velocityMin: number | null;
    velocityMax: number | null;
    velocityAvg: number | null;
    coherenceAvg: number | null;
    minerals: string[];
    assemblages: string[];
    hyperAreaHa: number;
  };
  hyperspectral: DraftHyperRow[];
  insar: DraftInsarRow[];
  insarWarning: DraftInsarRow[];
  targets: DraftTargetRow[];
  stockpiles: DraftStockpileRow[];
};

export const getNi43101DraftReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Ni43101Draft | null> => {
    const { supabase } = context;
    const { projectId } = data;

    const [projectRes, targetsRes, hyperRes, insarRes, stockRes] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, code, name, commodity, country, region, center_lat, center_lng, description, crs_epsg",
        )
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("exploration_targets")
        .select("code, name, target_type, commodity, priority, score, lat, lng, stage")
        .eq("project_id", projectId)
        .order("code"),
      supabase
        .from("hyperspectral_products")
        .select(
          "source, mineral, assemblage, mean_score, max_score, area_ha, cells_above_threshold, acquisition_date",
        )
        .eq("project_id", projectId)
        .order("mean_score", { ascending: false, nullsFirst: false }),
      supabase
        .from("insar_displacement")
        .select(
          "asset_name, asset_type, source, alert_severity, velocity_mm_year, cumulative_displacement_mm, coherence, reference_date, end_date",
        )
        .eq("project_id", projectId),
      supabase
        .from("stockpile_volumes")
        .select("name, material, volume_m3, area_m2, mean_height_m")
        .eq("project_id", projectId),
    ]);

    if (projectRes.error || !projectRes.data) return null;
    const p = projectRes.data;

    const targets: DraftTargetRow[] = (targetsRes.data ?? []).map((t: Record<string, unknown>) => ({
      code: t.code as string,
      name: t.name as string,
      targetType: t.target_type as DraftTargetRow["targetType"],
      commodity: t.commodity as string | null,
      priority: t.priority as DraftTargetRow["priority"],
      score: t.score == null ? null : Number(t.score),
      lat: t.lat == null ? null : Number(t.lat),
      lng: t.lng == null ? null : Number(t.lng),
      stage: t.stage as DraftTargetRow["stage"],
    }));

    const hyperspectral: DraftHyperRow[] = (hyperRes.data ?? []).map(
      (h: Record<string, unknown>) => ({
        source: h.source as string,
        mineral: h.mineral as string,
        assemblage: h.assemblage as string | null,
        meanScore: h.mean_score == null ? null : Number(h.mean_score),
        maxScore: h.max_score == null ? null : Number(h.max_score),
        areaHa: h.area_ha == null ? null : Number(h.area_ha),
        cellsAboveThreshold: (h.cells_above_threshold as number | null) ?? null,
        acquisitionDate: String(h.acquisition_date).slice(0, 10),
      }),
    );

    const insar: DraftInsarRow[] = (insarRes.data ?? [])
      .map((i: Record<string, unknown>) => ({
        assetName: (i.asset_name as string | null) ?? "(sin nombre)",
        assetType: i.asset_type as string,
        source: i.source as string,
        alertSeverity: i.alert_severity as DraftInsarRow["alertSeverity"],
        velocityMmYear: Number(i.velocity_mm_year),
        cumulativeMm:
          i.cumulative_displacement_mm == null ? null : Number(i.cumulative_displacement_mm),
        coherence: i.coherence == null ? null : Number(i.coherence),
        referenceDate: String(i.reference_date).slice(0, 10),
        endDate: String(i.end_date).slice(0, 10),
      }))
      .sort((a, b) => Math.abs(b.velocityMmYear) - Math.abs(a.velocityMmYear));

    const insarWarning = insar.filter((i) => (i.alertSeverity ?? "").toLowerCase() === "warning");
    const insarInfo = insar.filter((i) => (i.alertSeverity ?? "").toLowerCase() === "info").length;

    const vels = insar.map((i) => i.velocityMmYear).filter((v) => Number.isFinite(v));
    const cohs = insar.map((i) => i.coherence ?? 0).filter((c) => c > 0);

    const stockpiles: DraftStockpileRow[] = (stockRes.data ?? []).map(
      (s: Record<string, unknown>) => ({
        name: s.name as string,
        material: s.material as string,
        volumeM3: s.volume_m3 == null ? null : Number(s.volume_m3),
        areaM2: s.area_m2 == null ? null : Number(s.area_m2),
        meanHeightM: s.mean_height_m == null ? null : Number(s.mean_height_m),
      }),
    );

    const minerals = Array.from(new Set(hyperspectral.map((h) => h.mineral))).sort();
    const assemblages = Array.from(
      new Set(hyperspectral.map((h) => h.assemblage).filter((x): x is string => !!x)),
    ).sort();

    return {
      generatedAt: new Date().toISOString(),
      project: {
        id: p.id,
        code: p.code,
        name: p.name,
        commodity: p.commodity,
        country: p.country,
        region: p.region,
        centerLat: p.center_lat == null ? null : Number(p.center_lat),
        centerLng: p.center_lng == null ? null : Number(p.center_lng),
        description: p.description,
        crsEpsg: p.crs_epsg,
      },
      stats: {
        totalTargets: targets.length,
        totalHyperspectral: hyperspectral.length,
        totalInsar: insar.length,
        insarWarning: insarWarning.length,
        insarInfo,
        velocityMin: vels.length ? Math.min(...vels) : null,
        velocityMax: vels.length ? Math.max(...vels) : null,
        velocityAvg: vels.length ? vels.reduce((a, b) => a + b, 0) / vels.length : null,
        coherenceAvg: cohs.length ? cohs.reduce((a, b) => a + b, 0) / cohs.length : null,
        minerals,
        assemblages,
        hyperAreaHa: hyperspectral.reduce((a, h) => a + (h.areaHa ?? 0), 0),
      },
      hyperspectral,
      insar,
      insarWarning,
      targets,
      stockpiles,
    };
  });
