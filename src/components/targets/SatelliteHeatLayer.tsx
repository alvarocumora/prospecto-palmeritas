import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import type {
  AnomalyRow,
  SatIndexCode,
} from "@/hooks/useProjectSatelliteAnomalies";

export const HEAT_GRADIENTS: Record<SatIndexCode, Record<number, string>> = {
  IRON_OXIDE: {
    0.2: "#fde68a",
    0.45: "#f59e0b",
    0.7: "#dc2626",
    1.0: "#7f1d1d",
  },
  CLAY_MINERALS: {
    0.2: "#fef3c7",
    0.45: "#fbbf24",
    0.7: "#d97706",
    1.0: "#78350f",
  },
  HYDROTHERMAL_ALTERATION: {
    0.2: "#ddd6fe",
    0.45: "#a78bfa",
    0.7: "#c026d3",
    1.0: "#581c87",
  },
  STRUCTURAL_LINEAMENTS: {
    0.2: "#a5f3fc",
    0.5: "#22d3ee",
    1.0: "#0e7490",
  },
};

function centroidOf(geom: GeoJSON.Geometry): [number, number] | null {
  if (!geom) return null;
  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates as [number, number];
    return [lat, lng];
  }
  if (geom.type === "Polygon") {
    const ring = geom.coordinates[0] as [number, number][];
    let x = 0;
    let y = 0;
    for (const [lng, lat] of ring) {
      x += lng;
      y += lat;
    }
    return [y / ring.length, x / ring.length];
  }
  if (geom.type === "MultiPolygon") {
    const ring = (geom.coordinates[0]?.[0] ?? []) as [number, number][];
    if (!ring.length) return null;
    let x = 0;
    let y = 0;
    for (const [lng, lat] of ring) {
      x += lng;
      y += lat;
    }
    return [y / ring.length, x / ring.length];
  }
  return null;
}

function bboxOf(geom: GeoJSON.Geometry): [number, number, number, number] | null {
  if (!geom) return null;
  const coords: [number, number][] = [];
  const walk = (c: unknown) => {
    if (typeof (c as number[])[0] === "number") {
      coords.push(c as [number, number]);
    } else {
      for (const sub of c as unknown[]) walk(sub);
    }
  };
  if (geom.type === "Point") coords.push(geom.coordinates as [number, number]);
  else if ("coordinates" in geom) walk(geom.coordinates);
  if (!coords.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function pointsForAnomaly(a: AnomalyRow): L.HeatLatLngTuple[] {
  const c = centroidOf(a.geometry);
  if (!c) return [];
  const score = Math.max(0.15, Math.min(1, Number(a.score) || 0.5));
  if (a.geometry.type === "Point") return [[c[0], c[1], score]];
  const bb = bboxOf(a.geometry);
  if (!bb) return [[c[0], c[1], score]];
  const [minLng, minLat, maxLng, maxLat] = bb;
  const halfLat = (maxLat - minLat) / 2 || 0.0005;
  const halfLng = (maxLng - minLng) / 2 || 0.0005;
  // Sample 9 points: center + ring of 8 with gaussian-ish weights
  const samples: L.HeatLatLngTuple[] = [[c[0], c[1], score]];
  const ringWeight = score * 0.7;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const ang = (i / steps) * Math.PI * 2;
    samples.push([
      c[0] + Math.sin(ang) * halfLat * 0.6,
      c[1] + Math.cos(ang) * halfLng * 0.6,
      ringWeight,
    ]);
  }
  return samples;
}

type Props = {
  anomalies: AnomalyRow[];
  indexCode: SatIndexCode;
  visible?: boolean;
};

export function SatelliteHeatLayer({ anomalies, indexCode, visible = true }: Props) {
  const map = useMap();

  const points = useMemo<L.HeatLatLngTuple[]>(() => {
    const out: L.HeatLatLngTuple[] = [];
    for (const a of anomalies) {
      for (const p of pointsForAnomaly(a)) out.push(p);
      if (out.length >= 5000) break;
    }
    return out;
  }, [anomalies]);

  useEffect(() => {
    if (!visible || points.length === 0) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const layer = L.heatLayer(points, {
      radius: isMobile ? 22 : 30,
      blur: isMobile ? 18 : 25,
      maxZoom: 16,
      max: 1,
      minOpacity: 0.35,
      gradient: HEAT_GRADIENTS[indexCode],
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, indexCode, visible]);

  return null;
}
