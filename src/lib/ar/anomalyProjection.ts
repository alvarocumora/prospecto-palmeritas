import { bearingDegrees, haversineMeters } from "@/hooks/useGeolocation";
import type {
  ArExplorationSource,
  ArProjectedObject,
  ArProjectionOptions,
  ArViewerPosition,
} from "@/types/ar";

const DEFAULT_OPTIONS: Required<ArProjectionOptions> = {
  maxDistanceM: 5000,
  nearbyDistanceM: 250,
};

function normalizeRelativeBearing(viewerHeading: number | null | undefined, bearing: number) {
  if (viewerHeading == null || !Number.isFinite(viewerHeading)) return null;
  let relative = bearing - viewerHeading;
  while (relative > 180) relative -= 360;
  while (relative < -180) relative += 360;
  return relative;
}

function compactDistance(distanceM: number) {
  return distanceM >= 1000
    ? `${(distanceM / 1000).toFixed(1)} km`
    : `${Math.round(distanceM)} m`;
}

function compactLabel(label: string, distanceM: number) {
  return `${label} · ${compactDistance(distanceM)}`;
}

export function projectExplorationObjects(
  viewer: ArViewerPosition,
  sources: ArExplorationSource[],
  options?: ArProjectionOptions,
): ArProjectedObject[] {
  const cfg = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  return sources
    .map((source) => {
      const distanceM = haversineMeters(viewer, source);
      const bearingDeg = bearingDegrees(viewer, source);
      const relativeBearingDeg = normalizeRelativeBearing(viewer.headingDeg, bearingDeg);
      const relativeElevationM =
        source.elevationM != null && viewer.altitudeM != null
          ? source.elevationM - viewer.altitudeM
          : null;

      return {
        ...source,
        distanceM,
        bearingDeg,
        relativeBearingDeg,
        relativeElevationM,
        labelCompact: compactLabel(source.label, distanceM),
        isNearby: distanceM <= cfg.nearbyDistanceM,
      } satisfies ArProjectedObject;
    })
    .filter((o) => o.distanceM <= cfg.maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
