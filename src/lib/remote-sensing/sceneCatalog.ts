import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";
import type { RemoteSensingScene } from "@/lib/mining-intelligence/types";
import type { SentinelAssets } from "@/lib/remote-sensing/rasterSampler";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign";
type Asset = { href?: string };
type Feature = {
  id?: string;
  properties?: Record<string, unknown>;
  assets?: Record<string, Asset>;
  links?: Array<{ rel?: string; href?: string }>;
};
export type AnalysisScene = RemoteSensingScene & { assets: SentinelAssets | null };

async function sign(href: string) {
  const r = await fetch(`${SIGN}?href=${encodeURIComponent(href)}`);
  if (!r.ok) throw new Error(`PC_SIGN_${r.status}`);
  const j = (await r.json()) as { href?: string };
  if (!j.href) throw new Error("PC_SIGN_NO_HREF");
  return j.href;
}
async function analysisAssets(f: Feature): Promise<SentinelAssets | null> {
  const a = f.assets ?? {};
  const keys = ["B02", "B04", "B08", "B11", "B12"] as const;
  if (keys.some((k) => !a[k]?.href)) return null;
  const signed = await Promise.all(keys.map((k) => sign(a[k]!.href!)));
  const scl = a.SCL?.href ? await sign(a.SCL.href) : undefined;
  const [b02, b04, b08, b11, b12] = signed as [string, string, string, string, string];
  return { b02, b04, b08, b11, b12, scl };
}
export async function searchSentinel2AnalysisScenes(input: {
  bbox: [number, number, number, number];
  from: string;
  to: string;
  maxCloudPct?: number;
  limit?: number;
}) {
  const res = await fetch(`${STAC}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      bbox: input.bbox,
      datetime: `${input.from}/${input.to}`,
      query: { "eo:cloud_cover": { lt: input.maxCloudPct ?? 25 } },
      limit: input.limit ?? 12,
    }),
  });
  if (!res.ok) return { ok: false, error: `STAC ${res.status}`, scenes: [] as AnalysisScene[] };
  const j = (await res.json()) as { features?: Feature[] };
  const scenes = await Promise.all(
    (j.features ?? []).map(async (f): Promise<AnalysisScene> => {
      const p = f.properties ?? {};
      return {
        id: String(f.id ?? ""),
        sensor: "sentinel-2-l2a",
        datetime: String(p.datetime ?? ""),
        cloudPct: typeof p["eo:cloud_cover"] === "number" ? (p["eo:cloud_cover"] as number) : null,
        sourceUrl: (f.links ?? []).find((l) => l.rel === "self")?.href ?? null,
        assets: await analysisAssets(f),
      };
    }),
  );
  scenes.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));
  return { ok: true, error: null, scenes };
}
export async function searchSentinel2Scenes(input: {
  bbox: [number, number, number, number];
  from: string;
  to: string;
  maxCloudPct?: number;
  limit?: number;
}) {
  const r = await searchSentinel2AnalysisScenes(input);
  return { ok: r.ok, error: r.error, scenes: r.scenes.map(({ assets: _, ...s }) => s) };
}
export async function searchScenesForContext(
  context: ProjectSpatialContext,
  from: string,
  to: string,
  maxCloudPct = 25,
) {
  return searchSentinel2Scenes({ bbox: context.bboxWgs84, from, to, maxCloudPct });
}
