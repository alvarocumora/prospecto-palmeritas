import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";

// GeoScene3D — tipos compartidos del visor canónico.
// Motor único MapLibre + deck.gl; los visores three.js heredados fueron retirados.

export type GeoSceneMode = "surface" | "subsurface" | "resource";

export type GeoSceneVariant = "default" | "mag";

export const MODE_LABELS: Record<GeoSceneMode, { label: string; sub: string }> = {
  surface: { label: "Surface", sub: "DEM · Sentinel · targets" },
  subsurface: { label: "Subsurface", sub: "Sondajes · interceptos · modelos · anomalías" },
  resource: { label: "Resource", sub: "Bloques · clasificación · pit shells" },
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
  mode?: GeoSceneMode;
  variant?: GeoSceneVariant;
  showModeTabs?: boolean;
  className?: string;
  /** Preset canónico inicial de capas 3D. */
  initialPreset?: GeoViewerPresetId;
  /** Operational filters shared with the 2D map/saved views. */
  filters?: GeoSceneFilters;
};
