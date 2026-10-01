import type { LayerStateMap } from "@/hooks/useLayerState";
import { getGeoViewerPreset, resolveGeoLayer, type GeoViewerPresetId } from "./layerRegistry";

export function layerStateForPreset(
  defaults: LayerStateMap,
  presetId: GeoViewerPresetId,
): LayerStateMap {
  const preset = getGeoViewerPreset(presetId);
  const enabled = new Set<string>(preset.enabled);

  return Object.fromEntries(
    Object.entries(defaults).map(([id, state]) => {
      const definition = resolveGeoLayer(id);
      if (!definition || definition.domain === "basemap") return [id, state];

      return [
        id,
        {
          ...state,
          visible: enabled.has(definition.id),
        },
      ];
    }),
  );
}
