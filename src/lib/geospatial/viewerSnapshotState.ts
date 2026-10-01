import {
  buildGeoSnapshotManifest,
  type GeoSnapshotFilters,
  type GeoSnapshotManifest,
  type GeoSnapshotViewState,
} from "./snapshotManifest";

export type ViewerSnapshotDataset = {
  geoEngine?: string;
  geoLayerIds?: string;
  geoFilters?: string;
  geoViewState?: string;
  geoProjectId?: string;
  geoMode?: string;
  geoPreset?: string;
  geoProfile?: string;
  geoCrs?: string;
};

function parseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseMode(value: string | undefined): "2d" | "3d" | null {
  return value === "2d" || value === "3d" ? value : null;
}

function parseEngine(value: string | undefined): "leaflet" | "deckgl" | "public" | null {
  return value === "leaflet" || value === "deckgl" || value === "public" ? value : null;
}

export function buildManifestFromViewerDataset(
  dataset: ViewerSnapshotDataset,
  generatedAt?: string,
): GeoSnapshotManifest | null {
  const projectId = dataset.geoProjectId?.trim();
  const mode = parseMode(dataset.geoMode);
  const engine = parseEngine(dataset.geoEngine);
  const view = parseJson<GeoSnapshotViewState>(dataset.geoViewState);

  if (!projectId || !mode || !engine || !view) return null;

  const visibleLayerIds = (dataset.geoLayerIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const filters = parseJson<GeoSnapshotFilters>(dataset.geoFilters);

  return buildGeoSnapshotManifest({
    generatedAt,
    projectId,
    projectProfile: dataset.geoProfile ?? null,
    mode,
    engine,
    preset: dataset.geoPreset ?? null,
    crs: dataset.geoCrs === "EPSG:4326" ? "EPSG:4326" : undefined,
    view,
    filters,
    visibleLayerIds,
  });
}

export function readGeoSnapshotManifest(
  root?: ParentNode,
  generatedAt?: string,
): GeoSnapshotManifest | null {
  const resolvedRoot = root ?? (typeof document !== "undefined" ? document : null);
  if (!resolvedRoot) return null;

  const element = resolvedRoot.querySelector<HTMLElement>(
    "[data-geo-engine][data-geo-project-id][data-geo-view-state]",
  );
  if (!element) return null;

  const owner = element.closest<HTMLElement>("[data-geo-profile]");
  const dataset: ViewerSnapshotDataset = {
    geoEngine: element.dataset.geoEngine,
    geoLayerIds: element.dataset.geoLayerIds,
    geoFilters: element.dataset.geoFilters,
    geoViewState: element.dataset.geoViewState,
    geoProjectId: element.dataset.geoProjectId ?? owner?.dataset.projectId,
    geoMode: element.dataset.geoMode ?? owner?.dataset.geoMode,
    geoPreset: element.dataset.geoPreset ?? owner?.dataset.geoPreset,
    geoProfile: element.dataset.geoProfile ?? owner?.dataset.geoProfile,
    geoCrs: element.dataset.geoCrs,
  };

  return buildManifestFromViewerDataset(dataset, generatedAt);
}
