import { describe, expect, it } from "vitest";
import type { GeophysicsData, GeophysicsStation } from "@/types/geophysics";
import { buildFieldGeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import type { TerrainGrid } from "@/lib/geospatial/terrainCoordinates";
import {
  cholquiFieldGeophysics,
  geophysicsTerrainTriangles,
  stationsForCampaign,
} from "./geophysicsTerrain";

function station(id: string, overrides: Partial<GeophysicsStation> = {}): GeophysicsStation {
  return {
    id,
    station_id: id,
    project_id: "cholqui",
    survey_id: null,
    lat: 0,
    lng: 0,
    is_synthetic: false,
    mag_nt: 100,
    ip_chargeability_mvv: null,
    ip_resistivity_ohmm: null,
    notes: null,
    ...overrides,
  };
}

describe("Cholqui field geophysics on terrain", () => {
  it("excludes unassigned projects, other projects, synthetic and invalid positions", () => {
    const data: GeophysicsData = {
      surveys: [],
      lines: [],
      stations: [
        station("field"),
        station("global", { project_id: null }),
        station("other", { project_id: "other" }),
        station("synthetic", { is_synthetic: true }),
        station("invalid", { lat: 100 }),
        station("wrong-campaign", { survey_id: "unknown" }),
      ],
    };
    expect(cholquiFieldGeophysics(data, "cholqui").stations.map((item) => item.id)).toEqual([
      "field",
    ]);
    expect(cholquiFieldGeophysics(data, "other").stations.map((item) => item.id)).toEqual([
      "other",
    ]);
    expect(cholquiFieldGeophysics(null, "cholqui").stations).toEqual([]);
  });

  it("keeps campaign selection explicit", () => {
    const data: GeophysicsData = {
      surveys: [],
      lines: [],
      stations: [station("a"), station("b", { survey_id: "survey-b" })],
    };
    expect(stationsForCampaign(data, null).map((item) => item.id)).toEqual(["a"]);
    expect(stationsForCampaign(data, "survey-b").map((item) => item.id)).toEqual(["b"]);
  });

  it("drapes numerical cells on real heights and never invents elevation outside the DEM", () => {
    const grid: TerrainGrid = {
      source: "copernicus",
      size: 2,
      extentMeters: 200,
      centerLat: 0,
      centerLng: 0,
      heights: [12, 12, 12, 12],
    };
    const field = [
      station("a", { lat: -0.0002, lng: -0.0002, mag_nt: 90 }),
      station("b", { lat: -0.0002, lng: 0.0002, mag_nt: 110 }),
      station("c", { lat: 0.0002, lng: -0.0002, mag_nt: 100 }),
      station("d", { lat: 0.0002, lng: 0.0002, mag_nt: 120 }),
    ];
    const surface = buildFieldGeophysicsSurface(field, "mag_residual_nt", { gridSize: 8 })!;
    const triangles = geophysicsTerrainTriangles(surface, grid);
    expect(triangles.length).toBeGreaterThan(0);
    expect(
      triangles.every((triangle) =>
        triangle.points.every((point) => Math.abs(point[1] - 12) < 1e-8),
      ),
    ).toBe(true);
    expect(triangles.every((triangle) => Number.isFinite(triangle.value))).toBe(true);
    expect(geophysicsTerrainTriangles(surface, { ...grid, source: "synthetic" })).toEqual([]);
    expect(geophysicsTerrainTriangles(surface, { ...grid, centerLng: 10 })).toEqual([]);
  });
});
