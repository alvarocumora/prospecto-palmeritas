import type * as L from "leaflet";

export type LeafletNS = typeof L;
export type AnyFC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export const CENTER: [number, number] = [-33.898438, -71.115471];

export function sourceLine(src: unknown): string {
  if (!src) return "";
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #3a322c;color:#A89080;font-size:10px;">📎 ${String(src)}</div>`;
}
