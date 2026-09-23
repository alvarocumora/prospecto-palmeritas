import type { MapSnapshotManifest } from "./mapSnapshotEngine";

export type GeologicalEvidenceExport = {
  mapPng: string;
  manifest: MapSnapshotManifest;
  title: string;
  subtitle: string;
  disclaimer: string;
};

let latest: GeologicalEvidenceExport | null = null;

/**
 * In-memory handoff between the live geological map and client PDF composer.
 * It intentionally does not synthesize a fallback map.
 */
export function publishGeologicalEvidenceExport(value: GeologicalEvidenceExport) {
  latest = value;
}

export function getGeologicalEvidenceExport() {
  return latest;
}

export function clearGeologicalEvidenceExport() {
  latest = null;
}
