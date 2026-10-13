export const COMPARABLE_SENTINEL_INDICES = [
  "ndvi",
  "ndmi",
  "ironOxideRatio",
  "swirContrast",
] as const;

export type SentinelComparisonRow = {
  id: string;
  sceneId: string;
  acquisitionDate: string;
  validPixels: number;
  means: Partial<Record<(typeof COMPARABLE_SENTINEL_INDICES)[number], number>>;
};

type RunRecord = {
  id: string;
  external_scene_id: string | null;
  created_at: string;
  status: string;
  bbox: unknown;
  stats: unknown;
  source_metadata: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) return null;
  return value as [number, number, number, number];
}

function matchesBbox(
  candidate: [number, number, number, number],
  target: [number, number, number, number],
) {
  return candidate.every((value, index) => Math.abs(value - target[index]) <= 1e-6);
}

/**
 * Makes a scene table only for successful real runs with the same requested AOI.
 * It compares aggregate means, never pixel-by-pixel change or mineral presence.
 */
export function comparableSentinelRuns(
  runs: readonly RunRecord[],
  currentBbox: readonly number[] | null | undefined,
): SentinelComparisonRow[] {
  const target = parseBbox(currentBbox);
  if (!target) return [];

  return runs
    .flatMap((run): SentinelComparisonRow[] => {
      const bbox = parseBbox(run.bbox);
      if (
        run.status !== "succeeded" ||
        !run.external_scene_id ||
        !bbox ||
        !matchesBbox(bbox, target)
      )
        return [];

      const stats = record(run.stats);
      const metadata = record(run.source_metadata);
      const indices = record(stats?.indices);
      const dateValue = metadata?.acquisition_date;
      const acquisitionDate =
        typeof dateValue === "string" && Number.isFinite(Date.parse(dateValue))
          ? dateValue.slice(0, 10)
          : Number.isFinite(Date.parse(run.created_at))
            ? run.created_at.slice(0, 10)
            : null;
      const validPixels = stats?.valid_pixels;
      if (!indices || !acquisitionDate || typeof validPixels !== "number" || validPixels < 1)
        return [];

      const means: SentinelComparisonRow["means"] = {};
      for (const index of COMPARABLE_SENTINEL_INDICES) {
        const mean = record(indices[index])?.mean;
        if (typeof mean === "number" && Number.isFinite(mean)) means[index] = mean;
      }
      if (!Object.keys(means).length) return [];

      return [
        {
          id: run.id,
          sceneId: run.external_scene_id,
          acquisitionDate,
          validPixels,
          means,
        },
      ];
    })
    .sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
}
