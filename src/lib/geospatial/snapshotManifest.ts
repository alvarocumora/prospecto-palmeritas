import {
  resolveGeoLayer,
  type CanonicalGeoLayerId,
  type GeoEvidenceClass,
  type GeoLayerDomain,
  type GeoLayerUse,
} from "./layerRegistry";

export type GeoSnapshotBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type GeoSnapshotViewState = {
  center: { lng: number; lat: number };
  bounds: GeoSnapshotBounds;
  zoom: number;
  pitch?: number;
  bearing?: number;
};

export type GeoSnapshotFilters = {
  campaignId?: string | null;
  timeCursor?: number | null;
  highGradeOnly?: boolean;
};

export type GeoSnapshotLayer = {
  id: CanonicalGeoLayerId;
  label: string;
  domain: GeoLayerDomain;
  evidence: GeoEvidenceClass;
  use: GeoLayerUse;
  sourceSystem: string;
  datasetType?: string;
  units?: string;
  scaleLabel: string;
  caution?: string;
};

export type GeoSnapshotManifest = {
  schemaVersion: "1.0";
  generatedAt: string;
  projectId: string;
  projectProfile?: string | null;
  mode: "2d" | "3d";
  engine: "leaflet" | "deckgl" | "public";
  preset?: string | null;
  crs: "EPSG:4326";
  view: GeoSnapshotViewState;
  filters?: GeoSnapshotFilters | null;
  layers: GeoSnapshotLayer[];
  eligibleForReport: boolean;
  issues: string[];
  source: {
    registry: "canonical-geospatial-layer-registry";
    state: "viewer-runtime";
  };
};

export type BuildGeoSnapshotManifestInput = {
  generatedAt?: string;
  projectId: string;
  projectProfile?: string | null;
  mode: "2d" | "3d";
  engine: "leaflet" | "deckgl" | "public";
  preset?: string | null;
  crs?: "EPSG:4326";
  view: GeoSnapshotViewState;
  filters?: GeoSnapshotFilters | null;
  visibleLayerIds: readonly string[];
};

function toSnapshotLayer(idOrAlias: string): GeoSnapshotLayer | null {
  const definition = resolveGeoLayer(idOrAlias);
  if (!definition) return null;

  return {
    id: definition.id as CanonicalGeoLayerId,
    label: definition.label,
    domain: definition.domain,
    evidence: definition.evidence,
    use: definition.use,
    sourceSystem: definition.sourceSystem,
    datasetType: definition.datasetType,
    units: definition.units,
    scaleLabel: definition.scaleLabel,
    caution: definition.caution,
  };
}

export function buildGeoSnapshotManifest(
  input: BuildGeoSnapshotManifestInput,
): GeoSnapshotManifest {
  const issues = new Set<string>();
  const layerById = new Map<CanonicalGeoLayerId, GeoSnapshotLayer>();

  for (const idOrAlias of input.visibleLayerIds) {
    const definition = resolveGeoLayer(idOrAlias);
    if (!definition) {
      issues.add(`UNKNOWN_LAYER:${idOrAlias}`);
      continue;
    }

    const layer = toSnapshotLayer(idOrAlias);
    if (!layer) continue;
    layerById.set(layer.id, layer);

    if (!definition.capabilities.includes("report")) {
      issues.add(`NOT_REPORT_CAPABLE:${definition.id}`);
    }
  }

  const layers = [...layerById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const issueList = [...issues].sort();

  return {
    schemaVersion: "1.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    projectId: input.projectId,
    projectProfile: input.projectProfile ?? null,
    mode: input.mode,
    engine: input.engine,
    preset: input.preset ?? null,
    crs: input.crs ?? "EPSG:4326",
    view: input.view,
    filters: input.filters ?? null,
    layers,
    eligibleForReport: issueList.length === 0 && layers.length > 0,
    issues: issueList,
    source: {
      registry: "canonical-geospatial-layer-registry",
      state: "viewer-runtime",
    },
  };
}

export function stableGeoSnapshotPayload(manifest: GeoSnapshotManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    projectId: manifest.projectId,
    projectProfile: manifest.projectProfile ?? null,
    mode: manifest.mode,
    engine: manifest.engine,
    preset: manifest.preset ?? null,
    crs: manifest.crs,
    view: manifest.view,
    filters: manifest.filters ?? null,
    layers: manifest.layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      domain: layer.domain,
      evidence: layer.evidence,
      use: layer.use,
      sourceSystem: layer.sourceSystem,
      datasetType: layer.datasetType ?? null,
      units: layer.units ?? null,
      scaleLabel: layer.scaleLabel,
      caution: layer.caution ?? null,
    })),
    eligibleForReport: manifest.eligibleForReport,
    issues: manifest.issues,
    source: manifest.source,
  });
}
