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

// Firma resiliente: reintenta con backoff ante 429/5xx y DEGRADA a null en vez de
// lanzar. Firmar en vivo el endpoint de PC tiene rate limit; una excepción aquí
// tumbaba la página (PC_SIGN_429 -> blank screen).
async function sign(href: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${SIGN}?href=${encodeURIComponent(href)}`);
      if (r.ok) {
        const j = (await r.json()) as { href?: string };
        return j.href ?? null;
      }
      // 429 / 5xx: reintentar; otros errores no son recuperables
      if (r.status !== 429 && r.status < 500) return null;
    } catch {
      // error de red: reintentar
    }
    await new Promise((res) => setTimeout(res, 300 * 2 ** attempt));
  }
  return null;
}
async function analysisAssets(f: Feature): Promise<SentinelAssets | null> {
  const a = f.assets ?? {};
  const keys = ["B02", "B04", "B08", "B11", "B12"] as const;
  if (keys.some((k) => !a[k]?.href)) return null;
  const signed = await Promise.all(keys.map((k) => sign(a[k]!.href!)));
  if (signed.some((s) => s == null)) return null; // firma incompleta: degradar sin romper
  const scl = a.SCL?.href ? await sign(a.SCL.href) : undefined;
  const [b02, b04, b08, b11, b12] = signed as [string, string, string, string, string];
  return { b02, b04, b08, b11, b12, scl: scl ?? undefined };
}
export async function searchSentinel2AnalysisScenes(input: {
  bbox: [number, number, number, number];
  from: string;
  to: string;
  maxCloudPct?: number;
  limit?: number;
  withAssets?: boolean;
}) {
  const withAssets = input.withAssets ?? true;
  let res: Response;
  try {
    res = await fetch(`${STAC}/search`, {
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
  } catch {
    return { ok: false, error: "STAC_UNREACHABLE", scenes: [] as AnalysisScene[] };
  }
  if (!res.ok) return { ok: false, error: `STAC ${res.status}`, scenes: [] as AnalysisScene[] };
  const j = (await res.json()) as { features?: Feature[] };
  const scenes: AnalysisScene[] = [];
  // Sequential signing avoids Planetary Computer rate limits (HTTP 429).
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    let assets: SentinelAssets | null = null;
    if (withAssets) {
      try {
        assets = await analysisAssets(f);
      } catch {
        assets = null;
      }
    }
    scenes.push({
      id: String(f.id ?? ""),
      sensor: "sentinel-2-l2a",
      datetime: String(p.datetime ?? ""),
      cloudPct: typeof p["eo:cloud_cover"] === "number" ? (p["eo:cloud_cover"] as number) : null,
      sourceUrl: (f.links ?? []).find((l) => l.rel === "self")?.href ?? null,
      assets,
    });
  }
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
  // Listado para la UI: sin firmar assets (withAssets:false) -> evita la ráfaga
  // de firmas que disparaba PC_SIGN_429. La firma resiliente cubre el path de análisis.
  const r = await searchSentinel2AnalysisScenes({ ...input, withAssets: false });
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
