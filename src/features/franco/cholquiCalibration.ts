import { buildCholquiSpatialContext } from "@/features/franco/cholquiSpatialAdapter";
import { computeSpectralMetrics } from "@/lib/remote-sensing/anomalyEngine";
import { sampleSentinelBands } from "@/lib/remote-sensing/rasterSampler";
import { searchSentinel2AnalysisScenes } from "@/lib/remote-sensing/sceneCatalog";

export type CalibrationRow = {
  pointId: string;
  sceneId: string;
  datetime: string;
  cloudPct: number | null;
  metrics: ReturnType<typeof computeSpectralMetrics>;
  validPixels: number;
  maskedPixels: number;
  assayReportId: string | null;
  cuTotalPct: number | null;
  cuSolublePct: number | null;
  auGpt: number | null;
  agPpm: number | null;
};
export async function runCholquiCalibration(
  from: string,
  to: string,
  maxCloudPct = 15,
): Promise<CalibrationRow[]> {
  const ctx = buildCholquiSpatialContext();
  const catalog = await searchSentinel2AnalysisScenes({
    bbox: ctx.bboxWgs84,
    from,
    to,
    maxCloudPct,
    limit: 8,
  });
  if (!catalog.ok) throw new Error(catalog.error ?? "SATELLITE_SOURCE_UNAVAILABLE");
  const scenes = catalog.scenes.filter((s) => s.assets);
  const rows: CalibrationRow[] = [];
  for (const scene of scenes)
    for (const p of ctx.points) {
      if (!p.wgs84 || !scene.assets) continue;
      try {
        const sampled = await sampleSentinelBands(scene.assets, p.wgs84, {
          windowRadiusPx: 2,
          maskClouds: true,
        });
        rows.push({
          pointId: p.id,
          sceneId: scene.id,
          datetime: scene.datetime,
          cloudPct: scene.cloudPct,
          metrics: computeSpectralMetrics(sampled.bands),
          validPixels: sampled.validPixels,
          maskedPixels: sampled.maskedPixels,
          assayReportId: String(p.properties.assayReportId ?? "") || null,
          cuTotalPct: typeof p.properties.cuTotalPct === "number" ? p.properties.cuTotalPct : null,
          cuSolublePct:
            typeof p.properties.cuSolublePct === "number" ? p.properties.cuSolublePct : null,
          auGpt: typeof p.properties.auGpt === "number" ? p.properties.auGpt : null,
          agPpm: typeof p.properties.agPpm === "number" ? p.properties.agPpm : null,
        });
      } catch {
        /* retain scene run; invalid/clouded point is omitted */
      }
    }
  return rows;
}
