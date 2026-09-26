import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runCholquiCalibration } from "@/features/franco/cholquiCalibration";

const Input = z.object({
  from: z.string(),
  to: z.string(),
  maxCloudPct: z.number().min(1).max(80).default(15),
});
export const calibrateCholquiSatellite = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const rows = await runCholquiCalibration(data.from, data.to, data.maxCloudPct);
    const certified = rows.filter((r) => r.assayReportId);
    const metricNames = ["ndvi", "ndmi", "ironOxideRatio", "swirContrast"] as const;
    const summary = metricNames.map((metric) => {
      const v = certified
        .map((r) => r.metrics[metric])
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
        .sort((a, b) => a - b);
      const q = (p: number) =>
        v.length ? v[Math.min(v.length - 1, Math.floor((v.length - 1) * p))] : null;
      return { metric, n: v.length, p25: q(0.25), median: q(0.5), p75: q(0.75) };
    });
    return {
      project: "CHOLQUI",
      rows,
      summary,
      method: {
        window: "5x5 pixels",
        cloudMask: "Sentinel-2 SCL",
        statistics: "median per band; quartiles over certified point-scenes",
        interpretation: "calibration only; spectral response is not proof of mineralization",
      },
    };
  });
