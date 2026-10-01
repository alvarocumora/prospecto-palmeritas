export type EvidenceProvenance =
  "OFFICIAL" | "CERTIFIED" | "DOCUMENTARY" | "DECLARED" | "DERIVED" | "INTERPRETED";
export type SpatialQcStatus = "verified" | "review" | "invalid";
export type ProjectSpatialPoint = {
  id: string;
  projectId: string;
  label: string;
  original: { easting: number; northing: number; crs: string } | null;
  wgs84: { lat: number; lng: number } | null;
  provenance: EvidenceProvenance;
  qc: { status: SpatialQcStatus; notes: string[] };
  properties: Record<string, unknown>;
};
export type ProjectSpatialContext = {
  projectId: string;
  countryCode: string;
  authority: string | null;
  bboxWgs84: [number, number, number, number];
  points: ProjectSpatialPoint[];
  generatedAt: string;
};
export function bboxFromPoints(
  points: ProjectSpatialPoint[],
  paddingDeg = 0.01,
): [number, number, number, number] {
  const valid = points.flatMap((p) => (p.wgs84 ? [[p.wgs84.lng, p.wgs84.lat] as const] : []));
  if (!valid.length) throw new Error("SPATIAL_CONTEXT_HAS_NO_WGS84_POINTS");
  const xs = valid.map(([x]) => x);
  const ys = valid.map(([, y]) => y);
  return [
    Math.min(...xs) - paddingDeg,
    Math.min(...ys) - paddingDeg,
    Math.max(...xs) + paddingDeg,
    Math.max(...ys) + paddingDeg,
  ];
}
