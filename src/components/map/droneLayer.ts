import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LeafletNS } from "./types";
import type { DroneFlight, DroneRaster } from "@/hooks/useDroneFlights";

const SENSOR_COLOR: Record<string, string> = {
  rgb: "#22c55e",
  mag: "#a855f7",
  lidar: "#06b6d4",
  multispectral: "#f59e0b",
  thermal: "#ef4444",
};

function colorFor(sensor: string): string {
  return SENSOR_COLOR[sensor.toLowerCase()] ?? "#22c55e";
}

function escape(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

function flightPopup(f: DroneFlight): string {
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;min-width:200px;">
    <strong style="color:${colorFor(f.sensor)};">${escape(f.name)}</strong>
    <div style="color:#A89080;text-transform:uppercase;font-size:9px;margin-bottom:4px;">${escape(f.sensor)} · drone</div>
    <div>Piloto: ${escape(f.pilot ?? "—")}</div>
    <div>Altura: ${f.altitude_m ?? "—"} m</div>
    <div>Área: ${f.area_ha ?? "—"} ha</div>
    <div>Fecha: ${f.flown_at ?? "—"}</div>
  </div>`;
}

function rasterPopup(r: DroneRaster): string {
  return `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.5;min-width:200px;">
    <strong style="color:#C8922A;">${escape(r.name)}</strong>
    <div style="color:#A89080;text-transform:uppercase;font-size:9px;margin-bottom:4px;">${escape(r.raster_type)}</div>
    <div>Capturado: ${r.captured_at ?? "—"}</div>
    <div style="margin-top:4px;"><a href="${escape(r.url)}" target="_blank" rel="noopener" style="color:#C8922A;">Abrir raster ↗</a></div>
  </div>`;
}

function geomToLatLngs(geom: GeoJSON.Geometry): [number, number][][] {
  if (geom.type === "LineString") {
    return [geom.coordinates.map((c) => [c[1], c[0]] as [number, number])];
  }
  if (geom.type === "MultiLineString") {
    return geom.coordinates.map((line) => line.map((c) => [c[1], c[0]] as [number, number]));
  }
  if (geom.type === "Polygon") {
    return geom.coordinates.map((ring) => ring.map((c) => [c[1], c[0]] as [number, number]));
  }
  if (geom.type === "Point") {
    return [[[geom.coordinates[1], geom.coordinates[0]]]];
  }
  if (geom.type === "GeometryCollection") {
    return geom.geometries.flatMap(geomToLatLngs);
  }
  return [];
}

export function buildDroneLayer(
  L: LeafletNS,
  flights: DroneFlight[],
  rasters: DroneRaster[],
  opts: {
    onFlightClick?: (f: DroneFlight) => void;
    onRasterClick?: (r: DroneRaster) => void;
  } = {},
): LayerGroup {
  const group = L.layerGroup();

  // Rasters first (so flight paths render above)
  for (const r of rasters) {
    if (!r.url || !r.bounds_geojson) continue;
    const bbox = r.bounds_geojson as { bbox?: number[] } | number[];
    const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
    if (!arr || arr.length < 4) continue;
    const [minLng, minLat, maxLng, maxLat] = arr;
    try {
      const overlay = L.imageOverlay(
        r.url,
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { opacity: 0.75, interactive: true },
      );
      overlay.bindPopup(rasterPopup(r));
      if (opts.onRasterClick) overlay.on("click", () => opts.onRasterClick?.(r));
      overlay.addTo(group);
    } catch (err) {
      console.warn("[drone] raster overlay failed:", r.name, err);
    }
  }

  // Flight paths
  for (const f of flights) {
    if (!f.geometry_geojson) continue;
    const geom = f.geometry_geojson as GeoJSON.Geometry;
    const segments = geomToLatLngs(geom);
    if (!segments.length) continue;
    const color = colorFor(f.sensor);

    if (geom.type === "Point") {
      const [lat, lng] = segments[0][0];
      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#fff",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9,
      });
      marker.bindPopup(flightPopup(f));
      if (opts.onFlightClick) marker.on("click", () => opts.onFlightClick?.(f));
      marker.addTo(group);
      continue;
    }

    if (geom.type === "Polygon") {
      const poly = L.polygon(segments, {
        color,
        weight: 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.12,
        dashArray: "4,3",
      });
      poly.bindPopup(flightPopup(f));
      if (opts.onFlightClick) poly.on("click", () => opts.onFlightClick?.(f));
      poly.addTo(group);
      continue;
    }

    for (const line of segments) {
      const poly = L.polyline(line, {
        color,
        weight: 2.5,
        opacity: 0.85,
        dashArray: "6,4",
      });
      poly.bindPopup(flightPopup(f));
      if (opts.onFlightClick) poly.on("click", () => opts.onFlightClick?.(f));
      poly.addTo(group);
    }
  }

  return group;
}

export function fitToDrones(
  L: LeafletNS,
  map: LeafletMap,
  flights: DroneFlight[],
  rasters: DroneRaster[],
): void {
  const points: [number, number][] = [];
  for (const f of flights) {
    if (!f.geometry_geojson) continue;
    const segs = geomToLatLngs(f.geometry_geojson as GeoJSON.Geometry);
    segs.forEach((s) => points.push(...s));
  }
  for (const r of rasters) {
    const bbox = r.bounds_geojson as { bbox?: number[] } | number[] | null;
    if (!bbox) continue;
    const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
    if (!arr || arr.length < 4) continue;
    points.push([arr[1], arr[0]]);
    points.push([arr[3], arr[2]]);
  }
  if (!points.length) return;
  const bounds = L.latLngBounds(points);
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}
