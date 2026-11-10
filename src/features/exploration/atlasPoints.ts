import type { ProjectFacts } from "@/lib/projectFacts.functions";

export type AtlasSlug = "cholqui" | "losverdes";

export type AtlasProject = {
  slug: AtlasSlug;
  projectId: string;
  name: string;
  commodity: string;
  region: string;
  centroid: [number, number] | null;
};

/** Coordinates must come from the published ProjectFacts record, not a regional fallback. */
export function validAtlasCentroid(
  value: ProjectFacts["centroid"] | undefined,
): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lng, lat] = value;
  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }
  return [lng, lat];
}
