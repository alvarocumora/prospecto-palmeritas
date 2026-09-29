import type { GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";

// GeoScene3D — tipos compartidos del visor canónico.
// Sprint 2: API pública unificada; internamente delega a visores existentes
// (Geology3DViewer / SatToSubsurface3DViewer / MagAnomaly3DPro / BlockModel3DViewer)
// que serán portados a hooks de capas deck.gl en sprints siguientes.

export type GeoSceneMode = "surface" | "subsurface" | "resource";

export type GeoSceneVariant = "default" | "mag";

export const MODE_LABELS: Record<GeoSceneMode, { label: string; sub: string }> = {
  surface: { label: "Surface", sub: "DEM · Sentinel · targets" },
  subsurface: { label: "Subsurface", sub: "Sondajes · interceptos · modelos · anomalías" },
  resource: { label: "Resource", sub: "Bloques · clasificación · pit shells" },
};

export type GeoSceneEngine = "legacy" | "deckgl";

export type GeoSceneProps = {
  mode?: GeoSceneMode;
  variant?: GeoSceneVariant;
  showModeTabs?: boolean;
  className?: string;
  /** Motor de renderizado. GeoCapitals usa deck.gl por defecto; legacy queda para QA explícito. */
  engine?: GeoSceneEngine;
  /** Preset canónico inicial de capas 3D. */
  initialPreset?: GeoViewerPresetId;
  /** Expone el selector legacy/deck.gl sólo para QA y migración. */
  showLegacyEngineSwitch?: boolean;
};
