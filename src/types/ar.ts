export type ArExplorationObjectType =
  "target" | "magnetic_anomaly" | "satellite_anomaly" | "alteration" | "structure";

export type ArExplorationSource = {
  id: string;
  type: ArExplorationObjectType;
  label: string;
  lat: number;
  lng: number;
  elevationM?: number | null;
  depthEstimateM?: number | null;
  confidence?: number | null;
  intensity?: number | null;
  color?: string | null;
  metadata?: Record<string, unknown>;
};

export type ArViewerPosition = {
  lat: number;
  lng: number;
  altitudeM?: number | null;
  headingDeg?: number | null;
};

export type ArProjectedObject = ArExplorationSource & {
  distanceM: number;
  bearingDeg: number;
  relativeBearingDeg: number | null;
  relativeElevationM: number | null;
  labelCompact: string;
  isNearby: boolean;
};

export type ArProjectionOptions = {
  maxDistanceM?: number;
  nearbyDistanceM?: number;
};
