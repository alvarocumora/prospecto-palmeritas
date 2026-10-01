import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ProjectMap } from "@/components/ProjectMap";
import { useProjects } from "@/hooks/useProjects";
import {
  MAP_LAYER_STATE_EVENT,
  readStoredLayerState,
  type LayerStateMap,
} from "@/hooks/useLayerState";
import { resolveGeoLayer, type GeoViewerPresetId } from "@/lib/geospatial/layerRegistry";
import type { GeoSnapshotViewState } from "@/lib/geospatial/snapshotManifest";

function visibleCanonicalLayerIds(state: LayerStateMap): string[] {
  return Array.from(
    new Set(
      Object.entries(state)
        .filter(([, value]) => value.visible)
        .map(([id]) => resolveGeoLayer(id)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ).sort();
}

function leafletViewState(map: LeafletMap): GeoSnapshotViewState {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    center: { lng: center.lng, lat: center.lat },
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
    zoom: map.getZoom(),
  };
}

export function SnapshotAwareProjectMap({
  preset,
  profile,
  fillHeight = true,
}: {
  preset: GeoViewerPresetId;
  profile?: string | null;
  fillHeight?: boolean;
}) {
  const { active } = useProjects();
  const [layerState, setLayerState] = useState<LayerStateMap>(() => readStoredLayerState());
  const [viewState, setViewState] = useState<GeoSnapshotViewState | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LayerStateMap>).detail;
      if (detail) setLayerState(detail);
    };
    window.addEventListener(MAP_LAYER_STATE_EVENT, handler);
    return () => window.removeEventListener(MAP_LAYER_STATE_EVENT, handler);
  }, []);

  const handleMapReady = useCallback((map: LeafletMap) => {
    const sync = () => setViewState(leafletViewState(map));
    sync();
    map.on("moveend", sync);
    map.on("zoomend", sync);
  }, []);

  const layerIds = useMemo(() => visibleCanonicalLayerIds(layerState), [layerState]);

  return (
    <div
      className={fillHeight ? "h-full min-h-0" : undefined}
      data-geo-engine="leaflet"
      data-geo-mode="2d"
      data-geo-project-id={active?.id ?? undefined}
      data-geo-profile={profile ?? undefined}
      data-geo-preset={preset}
      data-geo-crs="EPSG:4326"
      data-geo-layer-ids={layerIds.join(",")}
      data-geo-view-state={viewState ? JSON.stringify(viewState) : undefined}
    >
      <ProjectMap initialPreset={preset} fillHeight={fillHeight} onMapReady={handleMapReady} />
    </div>
  );
}
