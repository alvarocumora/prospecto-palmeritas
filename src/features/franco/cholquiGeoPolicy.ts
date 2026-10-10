/** Shared display policy for the published Cholqui evidence. */
export const CHOLQUI_SPECTRAL_COLORS: Record<string, string> = {
  CLAY_MINERALS: "#0ea5e9",
  HYDROTHERMAL_ALTERATION: "#d946ef",
  IRON_OXIDE: "#f97316",
  STRUCTURAL_LINEAMENTS: "#eab308",
};

export const CHOLQUI_INTERPOLATION_NOTICE =
  "Las campañas satelitales usan poblaciones de fondo distintas y varios índices. Sus z-scores no son comparables: se muestran las huellas originales, sin interpolarlas juntas.";

export const CHOLQUI_COORDINATE_NOTICE =
  "Capas en WGS84 (EPSG:4326). Los puntos históricos conservan sus coordenadas publicadas, con origen PSAD56 / UTM 19S (EPSG:24879); la certificación del ensaye no certifica la posición.";
