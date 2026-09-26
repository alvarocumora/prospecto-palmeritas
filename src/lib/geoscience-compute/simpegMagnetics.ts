export const SIMPEG_MAGNETICS_SCHEMA_VERSION = "1" as const;

export type SimpegMagneticObservation = {
  x_m: number;
  y_m: number;
  z_m: number;
  tmi_nt: number;
  std_nt: number;
};

export type SimpegTopographyPoint = {
  x_m: number;
  y_m: number;
  z_m: number;
};

export type SimpegMagneticsPayload = {
  schema_version: typeof SIMPEG_MAGNETICS_SCHEMA_VERSION;
  job_id: string;
  project_id: string;
  crs: string;
  observations: SimpegMagneticObservation[];
  topography: SimpegTopographyPoint[];
  inducing_field: {
    amplitude_nt: number;
    inclination_deg: number;
    declination_deg: number;
  };
  mesh: {
    cell_size_m: number;
    padding_m: number;
    depth_m: number;
    max_cells?: number;
  };
  inversion?: {
    max_iterations?: number;
    lower_bound_si?: number;
    upper_bound_si?: number;
    starting_susceptibility_si?: number;
    beta0_ratio?: number;
  };
};

const finite = (value: number, field: string) => {
  if (!Number.isFinite(value)) throw new Error(`SIMPEG_MAGNETICS_INVALID_NUMBER:${field}`);
};

export function assertSimpegMagneticsPayload(payload: SimpegMagneticsPayload): void {
  if (payload.schema_version !== SIMPEG_MAGNETICS_SCHEMA_VERSION) {
    throw new Error("SIMPEG_MAGNETICS_SCHEMA_VERSION_UNSUPPORTED");
  }
  if (!payload.job_id || !payload.project_id || !payload.crs) {
    throw new Error("SIMPEG_MAGNETICS_IDENTITY_REQUIRED");
  }

  const normalizedCrs = payload.crs.toUpperCase().replaceAll(" ", "");
  if (["EPSG:4326", "WGS84", "WGS-84"].includes(normalizedCrs)) {
    throw new Error("SIMPEG_MAGNETICS_PROJECTED_METRIC_CRS_REQUIRED");
  }
  if (payload.observations.length < 4) throw new Error("SIMPEG_MAGNETICS_OBSERVATIONS_REQUIRED");
  if (payload.topography.length < 3) throw new Error("SIMPEG_MAGNETICS_TOPOGRAPHY_REQUIRED");

  payload.observations.forEach((row, index) => {
    finite(row.x_m, `observations[${index}].x_m`);
    finite(row.y_m, `observations[${index}].y_m`);
    finite(row.z_m, `observations[${index}].z_m`);
    finite(row.tmi_nt, `observations[${index}].tmi_nt`);
    finite(row.std_nt, `observations[${index}].std_nt`);
    if (row.std_nt <= 0) throw new Error("SIMPEG_MAGNETICS_POSITIVE_STD_REQUIRED");
  });
  payload.topography.forEach((row, index) => {
    finite(row.x_m, `topography[${index}].x_m`);
    finite(row.y_m, `topography[${index}].y_m`);
    finite(row.z_m, `topography[${index}].z_m`);
  });

  const field = payload.inducing_field;
  finite(field.amplitude_nt, "inducing_field.amplitude_nt");
  finite(field.inclination_deg, "inducing_field.inclination_deg");
  finite(field.declination_deg, "inducing_field.declination_deg");
  if (field.amplitude_nt <= 0) throw new Error("SIMPEG_MAGNETICS_FIELD_AMPLITUDE_REQUIRED");
  if (field.inclination_deg < -90 || field.inclination_deg > 90) {
    throw new Error("SIMPEG_MAGNETICS_FIELD_INCLINATION_INVALID");
  }

  finite(payload.mesh.cell_size_m, "mesh.cell_size_m");
  finite(payload.mesh.padding_m, "mesh.padding_m");
  finite(payload.mesh.depth_m, "mesh.depth_m");
  if (
    payload.mesh.cell_size_m <= 0 ||
    payload.mesh.padding_m < 0 ||
    payload.mesh.depth_m <= 0
  ) {
    throw new Error("SIMPEG_MAGNETICS_MESH_INVALID");
  }

  const inversion = payload.inversion ?? {};
  const lower = inversion.lower_bound_si ?? 0;
  const upper = inversion.upper_bound_si ?? 1;
  const start = inversion.starting_susceptibility_si ?? 1e-4;
  if (!(lower < upper) || start < lower || start > upper) {
    throw new Error("SIMPEG_MAGNETICS_BOUNDS_INVALID");
  }
  if (
    inversion.max_iterations != null &&
    (!Number.isInteger(inversion.max_iterations) ||
      inversion.max_iterations < 1 ||
      inversion.max_iterations > 100)
  ) {
    throw new Error("SIMPEG_MAGNETICS_MAX_ITERATIONS_INVALID");
  }
}

export function simpegMagneticsRunKey(payload: SimpegMagneticsPayload): string {
  assertSimpegMagneticsPayload(payload);
  return JSON.stringify({
    schemaVersion: payload.schema_version,
    projectId: payload.project_id,
    crs: payload.crs,
    observations: payload.observations,
    topography: payload.topography,
    inducingField: payload.inducing_field,
    mesh: payload.mesh,
    inversion: payload.inversion ?? {},
  });
}
