import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";
import type { RemoteSensingScene } from "@/lib/mining-intelligence/types";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";

export type SceneSearch = { bbox: [number, number, number, number]; from: string; to: string; maxCloudPct?: number; limit?: number; };
export type SceneCatalogResult = { ok: boolean; error: string | null; scenes: RemoteSensingScene[]; };

export async function searchSentinel2Scenes(input: SceneSearch): Promise<SceneCatalogResult> {
  try {
    const res = await fetch(`${STAC}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      collections: ["sentinel-2-l2a"], bbox: input.bbox, datetime: `${input.from}/${input.to}`,
      query: { "eo:cloud_cover": { lt: input.maxCloudPct ?? 25 } }, limit: input.limit ?? 24,
    }) });
    if (!res.ok) return { ok: false, error: `STAC ${res.status}`, scenes: [] };
    const json = await res.json() as { features?: Array<{ id?: string; properties?: Record<string, unknown>; links?: Array<{rel?:string;href?:string}> }> };
    const scenes = (json.features ?? []).map((f): RemoteSensingScene => {
      const p=f.properties ?? {}; return { id:String(f.id ?? ""), sensor:"sentinel-2-l2a", datetime:String(p["datetime"] ?? ""),
        cloudPct: typeof p["eo:cloud_cover"] === "number" ? p["eo:cloud_cover"] as number : null,
        sourceUrl: (f.links ?? []).find((l)=>l.rel==="self")?.href ?? null };
    }).sort((a,b)=>a.datetime < b.datetime ? 1 : -1);
    return { ok:true, error:null, scenes };
  } catch (e) { return { ok:false, error:e instanceof Error ? e.message : String(e), scenes:[] }; }
}

export async function searchScenesForContext(context: ProjectSpatialContext, from: string, to: string, maxCloudPct=25) {
  return searchSentinel2Scenes({ bbox: context.bboxWgs84, from, to, maxCloudPct });
}