// Sprint 6.7 — Split swipe view for two drone rasters (before/after).
// Mounts both rasters as L.imageOverlay on the same map; the LEFT raster gets a
// clip-path that hides everything to the right of `splitPx`, so dragging the
// divider reveals the RIGHT raster underneath. Pure CSS clip — no second map.

import type { ImageOverlay, LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "../map/types";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import { getRasterSignedUrl } from "@/hooks/useDroneFlights";

export type SwipeController = {
  group: LayerGroup;
  setSplit: (px: number) => void;
  destroy: () => void;
  fit: () => void;
};

async function rasterImageUrl(r: DroneRaster): Promise<string | null> {
  let url = r.url;
  if (r.storage_path) {
    const signed = await getRasterSignedUrl(r.storage_path);
    if (signed) url = signed;
  }
  return url ?? null;
}

function rasterBounds(r: DroneRaster): [number, number, number, number] | null {
  if (!r.bounds_geojson) return null;
  const bbox = r.bounds_geojson as { bbox?: number[] } | number[];
  const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
  if (!arr || arr.length < 4) return null;
  return [arr[0], arr[1], arr[2], arr[3]];
}

export async function buildRasterSwipeLayer(
  L: LeafletNS,
  map: LeafletMap,
  rasterA: DroneRaster,
  rasterB: DroneRaster,
): Promise<SwipeController | null> {
  const [urlA, urlB] = await Promise.all([rasterImageUrl(rasterA), rasterImageUrl(rasterB)]);
  const boundsA = rasterBounds(rasterA);
  const boundsB = rasterBounds(rasterB);
  if (!urlA || !urlB || !boundsA || !boundsB) return null;

  const group = L.layerGroup();

  // Right raster (B) — bottom layer, fully visible.
  const overlayB = L.imageOverlay(
    urlB,
    [
      [boundsB[1], boundsB[0]],
      [boundsB[3], boundsB[2]],
    ],
    { opacity: 1, interactive: false, className: "raster-swipe-b" },
  );
  overlayB.addTo(group);

  // Left raster (A) — clipped on top.
  const overlayA = L.imageOverlay(
    urlA,
    [
      [boundsA[1], boundsA[0]],
      [boundsA[3], boundsA[2]],
    ],
    { opacity: 1, interactive: false, className: "raster-swipe-a" },
  );
  overlayA.addTo(group);

  group.addTo(map);

  // Apply clip-path on the underlying <img> element of overlay A.
  const applyClip = (px: number) => {
    const imgA = (overlayA as ImageOverlay & { _image?: HTMLImageElement })._image;
    if (!imgA) return;
    // Convert split px from container coords to the image's local coords.
    const containerEl = map.getContainer();
    const rect = containerEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const ratio = Math.max(0, Math.min(1, px / containerWidth));
    // Get image bounds in container px to clip relative to the image itself.
    const imgRect = imgA.getBoundingClientRect();
    const imgLeft = imgRect.left - rect.left;
    const imgWidth = imgRect.width;
    if (imgWidth <= 0) {
      imgA.style.clipPath = "inset(0 100% 0 0)";
      return;
    }
    const splitWithinImage = px - imgLeft;
    const rightInsetPct = Math.max(
      0,
      Math.min(100, ((imgWidth - splitWithinImage) / imgWidth) * 100),
    );
    imgA.style.clipPath = `inset(0 ${rightInsetPct}% 0 0)`;
    void ratio;
  };

  let lastSplit = map.getContainer().getBoundingClientRect().width / 2;

  const reapply = () => applyClip(lastSplit);
  map.on("move", reapply);
  map.on("zoom", reapply);
  map.on("resize", reapply);

  // Fit to combined bounds initially.
  const fit = () => {
    const south = Math.min(boundsA[1], boundsB[1]);
    const west = Math.min(boundsA[0], boundsB[0]);
    const north = Math.max(boundsA[3], boundsB[3]);
    const east = Math.max(boundsA[2], boundsB[2]);
    map.fitBounds(L.latLngBounds([south, west], [north, east]), { padding: [60, 60] });
  };
  fit();
  // Re-clip after the fit animation settles.
  setTimeout(reapply, 350);

  return {
    group,
    setSplit(px: number) {
      lastSplit = px;
      applyClip(px);
    },
    fit,
    destroy() {
      map.off("move", reapply);
      map.off("zoom", reapply);
      map.off("resize", reapply);
      group.remove();
    },
  };
}
