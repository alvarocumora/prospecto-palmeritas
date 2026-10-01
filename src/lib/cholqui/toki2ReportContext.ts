import type { FeatureCollection, Polygon } from "geojson";
import catastroRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import { buildToki2ControlPoints, pointInPolygon, type LonLat } from "@/lib/cholqui/toki2Terrain";

type JsonFeatureCollection = FeatureCollection & { metadata?: Record<string, unknown> };

export type Toki2ReportContext = {
  name: string;
  rol: string;
  holder: string;
  concessionType: string;
  status: string;
  areaHa: number;
  controlPoints: Array<{
    code: string;
    purpose: string;
    lat: number;
    lng: number;
  }>;
  satelliteAnomaliesInside: number;
  satelliteRunId: string | null;
  satelliteProvider: string | null;
};

function parse(raw: string): JsonFeatureCollection | null {
  try {
    return JSON.parse(raw) as JsonFeatureCollection;
  } catch {
    return null;
  }
}

function centroid(geometry: unknown): LonLat | null {
  const coords: LonLat[] = [];
  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push([value[0], value[1]]);
      return;
    }
    value.forEach(walk);
  };
  walk((geometry as { coordinates?: unknown } | null)?.coordinates);
  if (!coords.length) return null;
  return [
    coords.reduce((sum, point) => sum + point[0], 0) / coords.length,
    coords.reduce((sum, point) => sum + point[1], 0) / coords.length,
  ];
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" ? value : null;
}

export function getToki2ReportContext(): Toki2ReportContext | null {
  const catastro = parse(catastroRaw);
  const anomalies = parse(anomaliesRaw);
  const feature = catastro?.features.find((item) =>
    String(item.properties?.nombre ?? "")
      .toUpperCase()
      .includes("TOKI 2"),
  );

  if (!feature || feature.geometry?.type !== "Polygon") return null;

  const ring = (feature.geometry as Polygon).coordinates[0] as LonLat[];
  const controlPoints = buildToki2ControlPoints(ring);
  const satelliteAnomaliesInside =
    anomalies?.features.reduce((count, item) => {
      const c = centroid(item.geometry);
      return c && pointInPolygon(c[0], c[1], ring) ? count + 1 : count;
    }, 0) ?? 0;

  return {
    name: String(feature.properties?.nombre ?? "TOKI 2"),
    rol: String(feature.properties?.rol ?? "s/d"),
    holder: String(feature.properties?.titular ?? feature.properties?.holder ?? "s/d"),
    concessionType: String(
      feature.properties?.tipo ?? feature.properties?.concession_type ?? "s/d",
    ),
    status: String(feature.properties?.estado ?? feature.properties?.status ?? "s/d"),
    areaHa: Number(feature.properties?.hectareas ?? feature.properties?.area_ha ?? 100) || 100,
    controlPoints,
    satelliteAnomaliesInside,
    satelliteRunId: metaString(anomalies?.metadata, "run_id"),
    satelliteProvider:
      metaString(anomalies?.metadata, "provider") ?? metaString(anomalies?.metadata, "source"),
  };
}
