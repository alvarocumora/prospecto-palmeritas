import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCholquiSpatialContext } from "@/features/franco/cholquiSpatialAdapter";
import { searchScenesForContext } from "@/lib/remote-sensing/sceneCatalog";

export type CholquiScene = {
  id: string; datetime: string; cloudPct: number | null;
  previewUrl: string | null; stacHref: string | null; platform: string | null;
};
export type CholquiSatelliteResult = {
  ok: boolean; error: string | null;
  bbox: [number, number, number, number]; scenes: CholquiScene[];
};
const Input = z.object({
  monthsBack: z.number().min(1).max(36).default(12),
  maxCloud: z.number().min(1).max(100).default(25),
}).default({ monthsBack: 12, maxCloud: 25 });

/** Compatibility adapter. Satellite discovery now runs through the global engine. */
export const getCholquiScenes = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d ?? {}))
  .handler(async ({ data }): Promise<CholquiSatelliteResult> => {
    const context = buildCholquiSpatialContext();
    const to = new Date();
    const from = new Date(to.getTime() - data.monthsBack * 30 * 24 * 3600 * 1000);
    const result = await searchScenesForContext(context, from.toISOString(), to.toISOString(), data.maxCloud);
    return {
      ok: result.ok, error: result.error, bbox: context.bboxWgs84,
      scenes: result.scenes.map((s) => ({
        id:s.id, datetime:s.datetime, cloudPct:s.cloudPct,
        previewUrl:null, stacHref:s.sourceUrl, platform:s.sensor,
      })),
    };
  });
