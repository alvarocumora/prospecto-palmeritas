import type { GeophysicsData, GeophysicsStation } from "@/types/geophysics";
import type { GeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import { projectTerrainPoint, type TerrainGrid } from "@/lib/geospatial/terrainCoordinates";

function validPosition(lng: number, lat: number): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) < 90;
}

/** The legacy service also returns global rows; Cholqui never adopts them as project evidence. */
export function cholquiFieldGeophysics(
  data: GeophysicsData | null,
  projectId: string,
): GeophysicsData {
  const surveys = (data?.surveys ?? []).filter((survey) => survey.project_id === projectId);
  const ids = new Set(surveys.map((survey) => survey.id));
  const sameSurvey = (id: string | null) => id === null || ids.has(id);
  return {
    surveys,
    stations: (data?.stations ?? []).filter(
      (station) =>
        station.project_id === projectId &&
        !station.is_synthetic &&
        sameSurvey(station.survey_id) &&
        validPosition(station.lng, station.lat),
    ),
    lines: (data?.lines ?? []).filter(
      (line) =>
        line.project_id === projectId &&
        !line.is_synthetic &&
        sameSurvey(line.survey_id) &&
        line.geometry_geojson?.type === "LineString" &&
        line.geometry_geojson.coordinates.every(([lng, lat]) => validPosition(lng, lat)),
    ),
  };
}

export function stationsForCampaign(
  data: GeophysicsData,
  surveyId: string | null,
): GeophysicsStation[] {
  return data.stations.filter((station) => station.survey_id === surveyId);
}

export type TerrainSurfaceTriangle = {
  points: Array<[number, number, number]>;
  value: number;
  normalized: number;
};

/** Drape numerical cells without inventing elevation or displacing them by anomaly magnitude. */
export function geophysicsTerrainTriangles(
  surface: GeophysicsSurface,
  tile: TerrainGrid,
): TerrainSurfaceTriangle[] {
  if (tile.source !== "copernicus") return [];
  const triangles: TerrainSurfaceTriangle[] = [];
  const cellM = tile.extentMeters / (tile.size - 1);
  if (!Number.isFinite(cellM) || cellM <= 0) return [];
  for (const cell of surface.cells) {
    const spanM = Math.max(
      (cell.north - cell.south) * 111_320,
      (cell.east - cell.west) * 111_320 * Math.cos((cell.lat * Math.PI) / 180),
    );
    const steps = Math.max(1, Math.min(8, Math.ceil(spanM / cellM)));
    for (let row = 0; row < steps; row++) {
      for (let col = 0; col < steps; col++) {
        const point = (x: number, y: number) =>
          projectTerrainPoint(
            tile,
            cell.west + ((col + x) / steps) * (cell.east - cell.west),
            cell.south + ((row + y) / steps) * (cell.north - cell.south),
          );
        const a = point(0, 0), b = point(1, 0), c = point(1, 1), d = point(0, 1);
        if (!a || !b || !c || !d) continue;
        triangles.push(
          { points: [a, b, c], value: cell.value, normalized: cell.normalized },
          { points: [a, c, d], value: cell.value, normalized: cell.normalized },
        );
      }
    }
  }
  return triangles;
}
