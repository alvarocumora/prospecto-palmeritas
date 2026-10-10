export type MiningConcession = {
  id: string;
  project_id: string;
  created_by: string;
  code: string;
  name: string;
  concession_type: string;
  status: string;
  holder: string | null;
  rut_holder?: string | null;
  area_ha: number | null;
  granted_at: string | null;
  expires_at: string | null;
  region: string | null;
  commune: string | null;
  geometry_geojson: unknown | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpiryStatus = "expired" | "critical" | "warning" | "ok" | "none";
