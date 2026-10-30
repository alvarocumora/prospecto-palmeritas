import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";
import type { GeoSceneProject, GeoSceneProjectLayer } from "./projectLayers";
import type { ProjectView } from "@/lib/projects/navigation";

// GeoScene3D — tipos compartidos del visor canónico.
// Motor único MapLibre + deck.gl; los visores three.js heredados fueron retirados.

export type GeoSceneMode = "surface" | "subsurface" | "resource";

export type GeoSceneVariant = "default" | "mag";

export const MODE_LABELS: Record<GeoSceneMode, { label: string; sub: string }> = {
  surface: { label: "Superficie", sub: "DEM · Sentinel · targets" },
  subsurface: { label: "Subsuelo", sub: "Sondajes · interceptos · modelos · anomalías" },
  resource: { label: "Recursos", sub: "Bloques · clasificación · pit shells" },
};

export type GeoSceneEngine = "deckgl";

export type GeoSceneFilters = {
  /** Filter exploration targets by campaign when the entity supports campaign_id. */
  campaignId?: string | null;
  /** Millisecond epoch cutoff for time-aware drilling/scene evidence. */
  timeCursor?: number | null;
  /** Restrict rendered assay intercepts to Au >= 1 g/t. */
  highGradeOnly?: boolean;
};

export type GeoSceneProps = {
  view?: ProjectView;
  showCopilot?: boolean;
  mode?: GeoSceneMode;
  variant?: GeoSceneVariant;
  showModeTabs?: boolean;
  className?: string;
  /** Preset canónico inicial de capas 3D. */
  initialPreset?: GeoViewerPresetId;
  /** Operational filters shared with the 2D map/saved views. */
  filters?: GeoSceneFilters;
  /** Explicit project/center; overrides the globally active project. */
  project?: GeoSceneProject;
  /** Project GeoJSON layers (cadastre, pedimentos, hitos) with registry provenance. */
  projectLayers?: GeoSceneProjectLayer[];
};
