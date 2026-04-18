import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GeophysicsSurvey = {
  id: string;
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
  survey_id: string | null;
  line_id: string;
  geometry_geojson: { type: "LineString"; coordinates: [number, number][] };
  length_m: number | null;
  is_synthetic: boolean;
  notes: string | null;
};

export type GeophysicsStation = {
  id: string;
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

export function useGeophysicsData() {
  const [data, setData] = useState<GeophysicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [surveys, lines, stations] = await Promise.all([
          supabase.from("geophysics_surveys").select("*").order("display_order"),
          supabase.from("geophysics_lines").select("*").order("line_id"),
          supabase.from("geophysics_stations").select("*").order("station_id"),
        ]);
        const firstError = surveys.error || lines.error || stations.error;
        if (firstError) throw firstError;
        if (!cancelled) {
          setData({
            surveys: (surveys.data ?? []) as GeophysicsSurvey[],
            lines: (lines.data ?? []) as unknown as GeophysicsLine[],
            stations: (stations.data ?? []) as GeophysicsStation[],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error loading geophysics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
