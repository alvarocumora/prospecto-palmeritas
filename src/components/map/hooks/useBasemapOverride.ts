import { useEffect } from "react";

export type BasemapOverride = "satellite" | "topo" | null | undefined;

type UseBasemapOverrideParams = {
  basemapOverride: BasemapOverride;
  setVisible: (layerId: string, visible: boolean) => void;
};

const BASEMAP_LAYER_IDS = [
  "basemap:esri-imagery",
  "basemap:esri-topo",
  "basemap:carto-dark",
  "basemap:opentopo",
] as const;

function setOnlyVisible(layerId: string, setVisible: (layerId: string, visible: boolean) => void) {
  for (const id of BASEMAP_LAYER_IDS) {
    setVisible(id, id === layerId);
  }
}

export function useBasemapOverride({ basemapOverride, setVisible }: UseBasemapOverrideParams) {
  useEffect(() => {
    if (!basemapOverride) return;

    if (basemapOverride === "satellite") {
      setOnlyVisible("basemap:esri-imagery", setVisible);
      return;
    }

    setOnlyVisible("basemap:esri-topo", setVisible);
  }, [basemapOverride, setVisible]);
}
