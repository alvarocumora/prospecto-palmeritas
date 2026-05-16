import { supabase } from "@/integrations/supabase/client";
import type {
  GeophysicsData,
  GeophysicsLine,
  GeophysicsStation,
  GeophysicsSurvey,
} from "@/types/geophysics";

export async function fetchGeophysicsData(projectId?: string | null): Promise<GeophysicsData> {
  const sQuery = supabase.from("geophysics_surveys").select("*").order("display_order");
  const lQuery = supabase.from("geophysics_lines").select("*").order("line_id");
  const stQuery = supabase.from("geophysics_stations").select("*").order("station_id");

  if (projectId) {
    sQuery.or(`project_id.eq.${projectId},project_id.is.null`);
    lQuery.or(`project_id.eq.${projectId},project_id.is.null`);
    stQuery.or(`project_id.eq.${projectId},project_id.is.null`);
  }

  const [surveys, lines, stations] = await Promise.all([sQuery, lQuery, stQuery]);
  const firstError = surveys.error || lines.error || stations.error;
  if (firstError) throw firstError;

  return {
    surveys: (surveys.data ?? []) as GeophysicsSurvey[],
    lines: (lines.data ?? []) as unknown as GeophysicsLine[],
    stations: (stations.data ?? []) as GeophysicsStation[],
  };
}
