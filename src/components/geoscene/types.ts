// GeoScene3D — tipos compartidos del visor canónico.
// Sprint 2: API pública unificada; internamente delega a visores existentes
// (Geology3DViewer / SatToSubsurface3DViewer / MagAnomaly3DPro / BlockModel3DViewer)
// que serán portados a hooks de capas deck.gl en sprints siguientes.

export type GeoSceneMode = "surface" | "subsurface" | "resource";

export type GeoSceneVariant = "default" | "mag";

export const MODE_LABELS: Record<GeoSceneMode, { label: string; sub: string }> = {
  surface: { label: "Surface", sub: "DEM · Sentinel · targets · anomalías" },
  subsurface: { label: "Subsurface", sub: "Vetas · pórfidos · sondajes · mag 3D" },
  resource: { label: "Resource", sub: "Bloques · leyes · pit · NPV" },
};

export type GeoSceneEngine = "legacy" | "deckgl";

export type GeoSceneProps = {
  mode?: GeoSceneMode;
  variant?: GeoSceneVariant;
  showModeTabs?: boolean;
  className?: string;
  /** Motor de renderizado: legacy (three.js) o deckgl (MapLibre + deck.gl). */
  engine?: GeoSceneEngine;
};
