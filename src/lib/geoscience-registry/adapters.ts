import type { DemTile } from "@/engine3d/terrain/dem.functions";
import type { DrillholesDataset } from "@/engine3d/data/drillholes.functions";
import type { SamplingResult } from "@/hooks/useSamplingResults";
import type { GeophysicsData } from "@/types/geophysics";
import type { DatasetRegistration } from "./types";

export function geophysicsRegistration(projectId: string, data: GeophysicsData): DatasetRegistration[] {
  return data.surveys.map((survey) => {
    const stations = data.stations.filter((station) => station.survey_id === survey.id);
    const synthetic = stations.length > 0 && stations.every((station) => station.is_synthetic);
    const methods = new Set<string>();
    if (stations.some((station) => station.mag_nt != null)) methods.add("magnetics");
    if (stations.some((station) => station.ip_chargeability_mvv != null)) methods.add("induced_polarization");
    if (stations.some((station) => station.ip_resistivity_ohmm != null)) methods.add("resistivity");
    return {
      projectId,
      datasetType: "geophysics",
      name: survey.name,
      method: [...methods].join("+") || survey.method || null,
      sourceSystem: "geophysics_surveys",
      sourceRef: survey.id,
      crs: "EPSG:4326",
      verticalDatum: null,
      geometryType: "Point+LineString",
      units: { magnetics: "nT", chargeability: "mV/V", resistivity: "ohm-m" },
      bboxWgs84: bboxFromLngLat(stations.map((station) => [station.lng, station.lat])),
      provenance: synthetic ? "DERIVED" : "DOCUMENTARY",
      qaStatus: synthetic ? "synthetic" : "unreviewed",
      qaSummary: { stationCount: stations.length, synthetic },
      acquisitionStart: null,
      acquisitionEnd: null,
      resolution: { stationSpacingM: survey.station_spacing_m ?? "unknown" },
      version: "1",
      contentHash: null,
      metadata: { surveyId: survey.id, status: survey.status, expectedDepthM: survey.expected_depth_m },
    };
  });
}

export function assayRegistration(projectId: string, rows: SamplingResult[]): DatasetRegistration {
  const certified = rows.filter((row) => row.certificate && row.lab);
  return {
    projectId,
    datasetType: "assay",
    name: "Project assays",
    method: "multi_element_assay",
    sourceSystem: "sampling_results",
    sourceRef: null,
    crs: null,
    verticalDatum: null,
    geometryType: null,
    units: { Au: "g/t", Ag: "g/t", Cu: "%", As: "ppm", Sb: "ppm", Hg: "ppm", Pb: "ppm", Zn: "ppm", Mo: "ppm" },
    bboxWgs84: null,
    provenance: certified.length === rows.length && rows.length > 0 ? "CERTIFIED" : "DOCUMENTARY",
    qaStatus: rows.some((row) => row.record_status === "rejected") ? "warning" : "unreviewed",
    qaSummary: { sampleCount: rows.length, certifiedCount: certified.length },
    acquisitionStart: minDate(rows.map((row) => row.sampled_at)),
    acquisitionEnd: maxDate(rows.map((row) => row.sampled_at)),
    resolution: {},
    version: "1",
    contentHash: null,
    metadata: { labs: [...new Set(rows.map((row) => row.lab).filter(Boolean))] },
  };
}

export function demRegistration(projectId: string, tile: DemTile): DatasetRegistration {
  const synthetic = tile.source === "synthetic";
  return {
    projectId,
    datasetType: "dem",
    name: synthetic ? "Procedural terrain fallback" : "Copernicus DEM GLO-30",
    method: "digital_elevation_model",
    sourceSystem: tile.source,
    sourceRef: null,
    crs: null,
    verticalDatum: null,
    geometryType: "Raster",
    units: { elevation: "m" },
    bboxWgs84: null,
    provenance: "DERIVED",
    qaStatus: synthetic ? "synthetic" : "unreviewed",
    qaSummary: { minRelativeM: tile.minH, maxRelativeM: tile.maxH },
    acquisitionStart: null,
    acquisitionEnd: null,
    resolution: { gridSize: tile.size, extentMeters: tile.extentMeters },
    version: "1",
    contentHash: null,
    metadata: { technicalUse: !synthetic },
  };
}

export function drillingRegistration(projectId: string, data: DrillholesDataset): DatasetRegistration {
  const synthetic = data.source === "planned-from-targets";
  return {
    projectId,
    datasetType: "drilling",
    name: synthetic ? "Planned drillholes from targets" : "Project drillholes",
    method: "drillhole_trajectory",
    sourceSystem: data.source,
    sourceRef: null,
    crs: data.source === "server" ? "PROJECT_SOURCE_CRS_REQUIRED" : null,
    verticalDatum: null,
    geometryType: "LineString",
    units: { depth: "m", azimuth: "deg", dip: "deg" },
    bboxWgs84: null,
    provenance: synthetic ? "INTERPRETED" : "DOCUMENTARY",
    qaStatus: synthetic ? "synthetic" : "warning",
    qaSummary: { holeCount: data.count, source: data.source, requiresExplicitSourceCrs: data.source === "server" },
    acquisitionStart: null,
    acquisitionEnd: null,
    resolution: {},
    version: "1",
    contentHash: null,
    metadata: { technicalUse: !synthetic && data.source === "server" },
  };
}

function bboxFromLngLat(points: [number, number][]): [number, number, number, number] | null {
  if (!points.length) return null;
  const lng = points.map(([x]) => x);
  const lat = points.map(([, y]) => y);
  return [Math.min(...lng), Math.min(...lat), Math.max(...lng), Math.max(...lat)];
}

function minDate(values: Array<string | null>): string | null {
  const clean = values.filter((value): value is string => Boolean(value)).sort();
  return clean[0] ?? null;
}

function maxDate(values: Array<string | null>): string | null {
  const clean = values.filter((value): value is string => Boolean(value)).sort();
  return clean.at(-1) ?? null;
}
