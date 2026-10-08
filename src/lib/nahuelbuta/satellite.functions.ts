import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchSentinel2Scenes } from "@/lib/remote-sensing/sceneCatalog";

/** AOI de los paños Arcillas (igual que geocapitals-remote/configs/losalamos_aoi.yaml). */
export const NAHUELBUTA_BBOX: [number, number, number, number] = [-73.325, -37.695, -73.07, -37.585];

const Input = z
  .object({ monthsBack: z.number().min(1).max(36).default(12), maxCloud: z.number().min(1).max(100).default(25) })
  .default({ monthsBack: 12, maxCloud: 25 });

export const getNahuelbutaScenes = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d ?? {}))
  .handler(async ({ data }) => {
    const to = new Date();
    const from = new Date(to.getTime() - data.monthsBack * 30 * 86400_000);
    const r = await searchSentinel2Scenes({
      bbox: NAHUELBUTA_BBOX,
      from: from.toISOString(),
      to: to.toISOString(),
      maxCloudPct: data.maxCloud,
    });
    return {
      ok: r.ok,
      error: r.error,
      scenes: r.scenes.slice(0, 24).map((s) => ({
        id: s.id,
        datetime: s.datetime,
        cloudPct: s.cloudPct,
        platform: s.sensor,
        stacHref: s.sourceUrl,
      })),
    };
  });
