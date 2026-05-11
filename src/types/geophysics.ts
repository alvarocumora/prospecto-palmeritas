export type GeophysicsSurvey = {
  id: string;
  project_id: string | null;
  name: string;
  method: string;
  status: string;
  planned_km: number | null;
  cost_usd: number | null;
  station_spacing_m: number | null;
  expected_depth_m: number | null;
  notes: string | null;
  display_order: number;
};

export type GeophysicsLine = {
  id: string;
  project_id: string | null;
  survey_id: string | null;
  line_id: string;
  geometry_geojson: { type: "LineString"; coordinates: [number, number][] };
  length_m: number | null;
  is_synthetic: boolean;
  notes: string | null;
};

export type GeophysicsStation = {
  id: string;
  project_id: string | null;
  survey_id: string | null;
  station_id: string;
  lat: number;
  lng: number;
  mag_nt: number | null;
  ip_chargeability_mvv: number | null;
  ip_resistivity_ohmm: number | null;
  is_synthetic: boolean;
  notes: string | null;
};

export type GeophysicsData = {
  surveys: GeophysicsSurvey[];
  lines: GeophysicsLine[];
  stations: GeophysicsStation[];
};
