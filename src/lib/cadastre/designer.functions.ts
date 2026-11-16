// Server fns del diseñador: catastro ocupado en un bbox (SERNAGEOMIN en vivo) y
// análisis satelital base (Sentinel-2 L2A) sobre el polígono solicitado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Bbox = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .refine(([w, s, e, n]) => e > w && n > s && e - w < 0.6 && n - s < 0.6, "Área demasiado grande");

export const getOccupiedInBbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ bbox: Bbox }).parse(d))
  .handler(async ({ data }) => {
    const { sngmQueryGeoJSON, SNGM_CONCESIONES_URL } = await import("@/lib/sngm");
    const [w, s, e, n] = data.bbox;
    const fc = await sngmQueryGeoJSON(SNGM_CONCESIONES_URL, {
      bbox: [w - 0.005, s - 0.005, e + 0.005, n + 0.005],
      where: "SITUACION_CONCESION IN ('CONSTITUIDA','EN TRAMITE')",
      outFields: "NUMERO_ROL,SITUACION_CONCESION,TIPO_CONCESION,NOMBRE",
      returnGeometry: true,
      limit: 2000,
    });
    return fc ? { ok: true as const, catastro: fc } : { ok: false as const, error: "No se pudo consultar SERNAGEOMIN." };
  });

export type SpectralIndexSummary = { key: string; label: string; mean: number; p90: number; anomalyPct: number };
export type AoiSpectralResult =
  | {
      ok: true;
      scene: { id: string; datetime: string; cloudPct: number | null; source: string };
      validPixels: number;
      indices: SpectralIndexSummary[];
      heat: GeoJSON.FeatureCollection;
    }
  | { ok: false; error: string };

const LABELS: Record<string, string> = {
  ironOxideRatio: "Óxidos de hierro (B04/B02)",
  swirContrast: "Arcillas / alteración (SWIR)",
  ndvi: "Vegetación (NDVI)",
  ndmi: "Humedad (NDMI)",
};

export const analyzeAoiSpectral = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ bbox: Bbox }).parse(d))
  .handler(async ({ data }): Promise<AoiSpectralResult> => {
    const bbox = data.bbox.map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number, number];
    const { memoize } = await import("@/lib/server/memoCache");
    try {
      return await memoize(`aoi-spectral:${bbox.join(",")}`, 6 * 3600_000, async () => {
        const { searchSentinel2Scenes } = await import("@/lib/remote-sensing/sceneCatalog");
        const { loadSentinelRasterScene } = await import("@/lib/remote-sensing/sentinelScene.server");
        const { processSentinelRaster } = await import("@/lib/remote-sensing/sentinelRaster");
        const to = new Date();
        const from = new Date(to.getTime() - 180 * 86400_000);
        const found = await searchSentinel2Scenes({ bbox, from: from.toISOString(), to: to.toISOString(), maxCloudPct: 15, limit: 12 });
        const scenes = (found.scenes ?? []).sort((a, b) => b.datetime.localeCompare(a.datetime));
        if (!scenes.length) return { ok: false as const, error: "Sin escena válida (nubosidad < 15 %) en los últimos 6 meses." };
        const signal = AbortSignal.timeout(45_000);
        const pick = scenes[0];
        const scene = await loadSentinelRasterScene(pick.id, signal);
        const r = await processSentinelRaster(scene, bbox, signal);
        const feats = r.preview.features;
        const indices: SpectralIndexSummary[] = ["ironOxideRatio", "swirContrast", "ndvi"].map((key) => {
          const vals = feats.map((f) => Number(f.properties[key])).filter((v) => Number.isFinite(v) && v !== -9999).sort((a, b) => a - b);
          const n = vals.length || 1;
          const mean = vals.reduce((a, v) => a + v, 0) / n;
          const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
          const p90 = vals[Math.floor(0.9 * (vals.length - 1))] ?? 0;
          const thr = mean + sd;
          const anomalyPct = key === "ndvi" ? 0 : Math.round((vals.filter((v) => v > thr).length / n) * 1000) / 10;
          return { key, label: LABELS[key], mean: round(mean), p90: round(p90), anomalyPct };
        });
        // Mapa de calor: z-score local del índice de óxidos (interpretación relativa).
        const iron = indices[0];
        const ironVals = feats.map((f) => Number(f.properties.ironOxideRatio));
        const m = ironVals.reduce((a, v) => a + v, 0) / (ironVals.length || 1);
        const sd = Math.sqrt(ironVals.reduce((a, v) => a + (v - m) ** 2, 0) / (ironVals.length || 1)) || 1;
        const heat: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: feats.map((f) => ({ type: "Feature", geometry: f.geometry, properties: { z: round((Number(f.properties.ironOxideRatio) - m) / sd) } })),
        };
        void iron;
        return {
          ok: true as const,
          scene: { id: pick.id, datetime: pick.datetime, cloudPct: pick.cloudPct, source: "Sentinel-2 L2A · Microsoft Planetary Computer" },
          validPixels: r.validPixels,
          indices,
          heat,
        };
      });
    } catch (e) {
      console.error("[analyzeAoiSpectral]", e);
      return { ok: false, error: "No se pudo procesar la escena satelital. Intenta con un área menor o más tarde." };
    }
  });

const round = (v: number) => Math.round(v * 1000) / 1000;
