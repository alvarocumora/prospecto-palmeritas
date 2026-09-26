import {
  reconcileCadastre,
  type ReconciliationResult,
  type ReconciliationState,
} from "./reconcileCadastre";

export type ReconciliationBundle = {
  generatedAt: string;
  source: "SERNAGEOMIN";
  project: GeoJSON.FeatureCollection;
  official: GeoJSON.FeatureCollection;
  results: ReconciliationResult[];
  summary: Record<ReconciliationState, number>;
};

export function buildReconciliationBundle(
  project: GeoJSON.FeatureCollection,
  official: GeoJSON.FeatureCollection,
  neighborKm = 5,
): ReconciliationBundle {
  const results = reconcileCadastre(project, official, neighborKm);
  const summary: Record<ReconciliationState, number> = {
    EXACT_MATCH: 0,
    INTERSECTS: 0,
    NEIGHBOR: 0,
    UNMATCHED: 0,
  };
  results.forEach((r) => summary[r.state]++);
  return {
    generatedAt: new Date().toISOString(),
    source: "SERNAGEOMIN",
    project,
    official,
    results,
    summary,
  };
}

export function reconciliationGeoJSON(bundle: ReconciliationBundle): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  bundle.results.forEach((r, index) => {
    const base =
      r.officialFeatureIndex == null
        ? bundle.project.features[r.projectFeatureIndex ?? -1]
        : bundle.official.features[r.officialFeatureIndex];
    if (!base?.geometry) return;
    features.push({
      type: "Feature",
      geometry: base.geometry,
      properties: {
        ...(base.properties ?? {}),
        GEOCAPITALS_STATE: r.state,
        GEOCAPITALS_OVERLAP_HA: Number(r.overlapHa.toFixed(4)),
        GEOCAPITALS_OVERLAP_PCT: Number(r.overlapPctProject.toFixed(2)),
        GEOCAPITALS_DISTANCE_KM: r.distanceKm == null ? null : Number(r.distanceKm.toFixed(3)),
        GEOCAPITALS_REASON: r.reasons.join("; "),
        GEOCAPITALS_RESULT_ID: index,
      },
    });
  });
  return { type: "FeatureCollection", features };
}
