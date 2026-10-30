import {
  getGeoLayer,
  getGeoViewerPreset,
  type CanonicalGeoLayerId,
  type GeoLayerDefinition,
  type GeoViewerPresetId,
} from "@/lib/geospatial/layerRegistry";
import type { GeoSceneMode } from "./types";

export type GeoSceneBindingKey =
  | "terrain"
  | "satellite_anomalies"
  | "targets"
  | "drillholes_completed"
  | "drillholes_proposed"
  | "drill_intercepts"
  | "geophysics_anomalies"
  | "geology_wireframes"
  | "resource_blocks"
  | "geophysics_emag2"
  | "geophysics_wgm2012";

export type GeoSceneLayerBinding = {
  key: GeoSceneBindingKey;
  canonicalId: CanonicalGeoLayerId;
  modes: readonly GeoSceneMode[];
};

export const GEOSCENE_LAYER_BINDINGS: readonly GeoSceneLayerBinding[] = [
  { key: "terrain", canonicalId: "territory.dem", modes: ["surface", "subsurface"] },
  {
    key: "satellite_anomalies",
    canonicalId: "remote_sensing.sentinel2_alteration",
    modes: ["surface"],
  },
  { key: "targets", canonicalId: "targets.exploration", modes: ["surface", "subsurface"] },
  {
    key: "drillholes_completed",
    canonicalId: "drilling.completed",
    modes: ["subsurface"],
  },
  {
    key: "drillholes_proposed",
    canonicalId: "drilling.proposed",
    modes: ["subsurface"],
  },
  {
    key: "drill_intercepts",
    canonicalId: "sampling.drill_intercepts",
    modes: ["subsurface"],
  },
  {
    key: "geophysics_anomalies",
    canonicalId: "geophysics.anomalies",
    modes: ["subsurface"],
  },
  {
    key: "geology_wireframes",
    canonicalId: "models.implicit_geology",
    modes: ["subsurface"],
  },
  {
    key: "resource_blocks",
    canonicalId: "models.resource_blocks",
    modes: ["resource"],
  },
  {
    key: "geophysics_emag2",
    canonicalId: "geophysics.emag2",
    modes: ["surface", "subsurface"],
  },
  {
    key: "geophysics_wgm2012",
    canonicalId: "geophysics.wgm2012",
    modes: ["surface", "subsurface"],
  },
];

export function initialGeoSceneLayerIds(
  presetId: GeoViewerPresetId = "official_3d",
): Set<CanonicalGeoLayerId> {
  return new Set(getGeoViewerPreset(presetId).enabled);
}

export function sceneBindingsForMode(mode: GeoSceneMode): GeoSceneLayerBinding[] {
  return GEOSCENE_LAYER_BINDINGS.filter((binding) => binding.modes.includes(mode));
}

export function sceneDefinitionsForMode(mode: GeoSceneMode): GeoLayerDefinition[] {
  return sceneBindingsForMode(mode)
    .map((binding) => getGeoLayer(binding.canonicalId))
    .filter((definition): definition is GeoLayerDefinition => Boolean(definition));
}

export function sceneLayerEnabled(
  enabled: ReadonlySet<string>,
  bindingKey: GeoSceneBindingKey,
): boolean {
  const binding = GEOSCENE_LAYER_BINDINGS.find((candidate) => candidate.key === bindingKey);
  return Boolean(binding && enabled.has(binding.canonicalId));
}
