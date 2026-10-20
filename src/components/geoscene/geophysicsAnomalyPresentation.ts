/**
 * Normalized geophysical anomaly markers. These are georeferenced observations
 * or interpreted anomaly targets, NOT measured subsurface volumes.
 */
export type GeophysicsAnomalyRow = {
  code: string;
  lat: number | null;
  lng: number | null;
  severity: string | null;
  estimated_depth_m: number | null;
  peak_value: number | null;
  anomaly_type: string | null;
};

export type GeophysicsAnomalyMarker = {
  code: string;
  lat: number;
  lng: number;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  estimatedDepthM: number | null;
  peakValue: number | null;
  type: string | null;
};

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function normalizeGeophysicalAnomalies(
  rows: readonly GeophysicsAnomalyRow[],
): GeophysicsAnomalyMarker[] {
  return rows.flatMap((row) => {
    if (
      !row.code?.trim() ||
      !isValidLatitude(row.lat) ||
      !isValidLongitude(row.lng)
    ) {
      return [];
    }
    const severity = row.severity?.toLowerCase().trim();
    const supportedSeverity = SEVERITIES.find((value) => value === severity);
    const estimatedDepthM =
      row.estimated_depth_m != null &&
      Number.isFinite(row.estimated_depth_m) &&
      row.estimated_depth_m > 0
        ? row.estimated_depth_m
        : null;
    const peakValue =
      row.peak_value != null && Number.isFinite(row.peak_value)
        ? row.peak_value
        : null;
    return [
      {
        code: row.code.trim().slice(0, 120),
        lat: row.lat,
        lng: row.lng,
        severity: supportedSeverity ?? "unknown",
        estimatedDepthM,
        peakValue,
        type: row.anomaly_type?.trim() || null,
      },
    ];
  });
}

/** Visual classes indicate a stored interpretation level, not assay grade. */
export const GEOPHYSICS_SEVERITY_COLORS: Record<
  GeophysicsAnomalyMarker["severity"],
  [number, number, number, number]
> = {
  critical: [217, 70, 239, 205],
  high: [239, 68, 68, 205],
  medium: [249, 115, 22, 205],
  low: [234, 179, 8, 205],
  unknown: [148, 163, 184, 205],
};
