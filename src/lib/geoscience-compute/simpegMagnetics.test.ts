import { describe, expect, it } from "vitest";
import {
  assertSimpegMagneticsPayload,
  simpegMagneticsRunKey,
  type SimpegMagneticsPayload,
} from "./simpegMagnetics";

const payload = (): SimpegMagneticsPayload => ({
  schema_version: "1",
  job_id: "job-1",
  project_id: "project-1",
  crs: "EPSG:32719",
  observations: [
    { x_m: 0, y_m: 0, z_m: 10, tmi_nt: 1, std_nt: 1 },
    { x_m: 20, y_m: 0, z_m: 10, tmi_nt: 2, std_nt: 1 },
    { x_m: 0, y_m: 20, z_m: 10, tmi_nt: 3, std_nt: 1 },
    { x_m: 20, y_m: 20, z_m: 10, tmi_nt: 4, std_nt: 1 },
  ],
  topography: [
    { x_m: -10, y_m: -10, z_m: 0 },
    { x_m: 30, y_m: -10, z_m: 0 },
    { x_m: -10, y_m: 30, z_m: 0 },
  ],
  inducing_field: { amplitude_nt: 50000, inclination_deg: -30, declination_deg: 5 },
  mesh: { cell_size_m: 10, padding_m: 10, depth_m: 30 },
});

describe("SimPEG Magnetics v1 contract", () => {
  it("accepts projected metric data", () => {
    expect(() => assertSimpegMagneticsPayload(payload())).not.toThrow();
  });

  it("rejects geographic WGS84 coordinates", () => {
    const item = payload();
    item.crs = "EPSG:4326";
    expect(() => assertSimpegMagneticsPayload(item)).toThrow(
      "SIMPEG_MAGNETICS_PROJECTED_METRIC_CRS_REQUIRED",
    );
  });

  it("produces a deterministic run key independent of job id", () => {
    const a = payload();
    const b = payload();
    b.job_id = "job-2";
    expect(simpegMagneticsRunKey(a)).toBe(simpegMagneticsRunKey(b));
  });
});
