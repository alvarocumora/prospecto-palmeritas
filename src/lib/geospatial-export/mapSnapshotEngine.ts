import type { Map as LeafletMap } from "leaflet";

export type MapSnapshotManifest = {
  projectCode: string;
  generatedAt: string;
  bounds: [[number, number], [number, number]];
  center: [number, number];
  zoom: number;
  crs: "EPSG:4326";
  layers: string[];
  source: "live-map";
};

/**
 * Captures the exact rendered Live Map canvas for institutional exports.
 * Leaflet tiles must be CORS-enabled; otherwise capture fails explicitly
 * instead of substituting a schematic map.
 */
export async function captureLiveMapSnapshot(
  map: LeafletMap,
  projectCode: string,
  layers: string[],
): Promise<{ dataUrl: string; manifest: MapSnapshotManifest }> {
  const node = map.getContainer();
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#0b1115",
    scale: Math.min(2, window.devicePixelRatio || 1),
    logging: false,
  });
  if (!canvas.width || !canvas.height) throw new Error("Live Map snapshot produced an empty canvas.");
  const b = map.getBounds();
  const c = map.getCenter();
  return {
    dataUrl: canvas.toDataURL("image/png", 1),
    manifest: {
      projectCode,
      generatedAt: new Date().toISOString(),
      bounds: [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]],
      center: [c.lat, c.lng],
      zoom: map.getZoom(),
      crs: "EPSG:4326",
      layers,
      source: "live-map",
    },
  };
}
