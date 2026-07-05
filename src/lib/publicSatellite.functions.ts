import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicSatProject = {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  commodity: string | null;
  center_lat: number | null;
  center_lng: number | null;
  cover_image_url: string | null;
  anomalies: Array<{
    id: string;
    index_code: string | null;
    severity: string | null;
    score: number | null;
    area_ha: number | null;
    detected_at: string | null;
    notes: string | null;
  }>;
  insar: Array<{
    id: string;
    asset_name: string | null;
    source: string | null;
    reference_date: string | null;
    end_date: string | null;
    velocity_mm_year: number | null;
    cumulative_displacement_mm: number | null;
    coherence: number | null;
    alert_severity: string | null;
  }>;
};

const DEMO_IDS = [
  "7a499b02-ecdf-447b-8956-b106fe4ec087",
  "e5360f13-1647-4e44-bb13-c0614e6f39fe",
  "8dc8e288-b22c-4bd4-9626-bb7fb85d1745",
];

export const getPublicSatellite = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSatProject[]> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, country, region, commodity, center_lat, center_lng, cover_image_url")
      .in("id", DEMO_IDS);

    const { data: anomalies } = await supabase
      .from("satellite_anomalies")
      .select("id, project_id, index_code, severity, score, area_ha, detected_at, notes")
      .in("project_id", DEMO_IDS)
      .order("detected_at", { ascending: false })
      .limit(500);

    const { data: insar } = await supabase
      .from("insar_displacement")
      .select(
        "id, project_id, asset_name, source, reference_date, end_date, velocity_mm_year, cumulative_displacement_mm, coherence, alert_severity",
      )
      .in("project_id", DEMO_IDS)
      .order("reference_date", { ascending: false })
      .limit(500);

    return (projects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      region: p.region,
      commodity: p.commodity,
      center_lat: p.center_lat,
      center_lng: p.center_lng,
      cover_image_url: p.cover_image_url,
      anomalies: (anomalies ?? [])
        .filter((a) => a.project_id === p.id)
        .map(({ project_id: _pid, ...rest }) => rest),
      insar: (insar ?? [])
        .filter((i) => i.project_id === p.id)
        .map(({ project_id: _pid, ...rest }) => rest),
    }));
  },
);
