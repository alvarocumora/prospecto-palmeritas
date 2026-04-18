import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Survey = {
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
  created_at: string;
};

export type Line = {
  id: string;
  project_id: string | null;
  survey_id: string | null;
  line_id: string;
  geometry_geojson: { type: "LineString"; coordinates: [number, number][] };
  length_m: number | null;
  is_synthetic: boolean;
  notes: string | null;
};

export type Station = {
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

export const SURVEY_METHODS = [
  "Magnetometría terrestre",
  "Magnetometría aérea",
  "IP — Cargabilidad",
  "IP — Resistividad",
  "CSAMT",
  "Gravimetría",
  "Radiometría",
  "TEM",
  "Sísmica",
] as const;

export const SURVEY_STATUS = ["planned", "in_progress", "completed", "cancelled"] as const;

export function useSurveys(projectId: string | null) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setSurveys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("geophysics_surveys")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setSurveys([]);
    } else {
      setSurveys((data ?? []) as Survey[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { surveys, loading, error, refresh };
}

export function useSurvey(surveyId: string | null) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!surveyId) {
      setSurvey(null);
      setLines([]);
      setStations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [s, l, st] = await Promise.all([
      supabase.from("geophysics_surveys").select("*").eq("id", surveyId).maybeSingle(),
      supabase.from("geophysics_lines").select("*").eq("survey_id", surveyId).order("line_id"),
      supabase.from("geophysics_stations").select("*").eq("survey_id", surveyId).order("station_id"),
    ]);
    const firstErr = s.error || l.error || st.error;
    if (firstErr) {
      setError(firstErr.message);
    } else {
      setSurvey((s.data as Survey | null) ?? null);
      setLines((l.data ?? []) as unknown as Line[]);
      setStations((st.data ?? []) as Station[]);
      setError(null);
    }
    setLoading(false);
  }, [surveyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { survey, lines, stations, loading, error, refresh };
}

export function useGeophysicsMutations() {
  const { user } = useAuth();

  const createSurvey = useCallback(
    async (projectId: string, payload: Partial<Survey>) => {
      if (!user) throw new Error("Sin sesión");
      const { data, error } = await supabase
        .from("geophysics_surveys")
        .insert({
          project_id: projectId,
          created_by: user.id,
          name: payload.name ?? "Sin nombre",
          method: payload.method ?? "Magnetometría terrestre",
          status: payload.status ?? "planned",
          planned_km: payload.planned_km ?? null,
          cost_usd: payload.cost_usd ?? null,
          station_spacing_m: payload.station_spacing_m ?? null,
          expected_depth_m: payload.expected_depth_m ?? null,
          notes: payload.notes ?? null,
          display_order: payload.display_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Survey;
    },
    [user]
  );

  const updateSurvey = useCallback(async (id: string, patch: Partial<Survey>) => {
    const { data, error } = await supabase
      .from("geophysics_surveys")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Survey;
  }, []);

  const deleteSurvey = useCallback(async (id: string) => {
    const { error } = await supabase.from("geophysics_surveys").delete().eq("id", id);
    if (error) throw error;
  }, []);

  const createStation = useCallback(
    async (projectId: string, surveyId: string, payload: Partial<Station>) => {
      if (!user) throw new Error("Sin sesión");
      const { data, error } = await supabase
        .from("geophysics_stations")
        .insert({
          project_id: projectId,
          survey_id: surveyId,
          created_by: user.id,
          station_id: payload.station_id ?? "ST-NEW",
          lat: payload.lat ?? 0,
          lng: payload.lng ?? 0,
          mag_nt: payload.mag_nt ?? null,
          ip_chargeability_mvv: payload.ip_chargeability_mvv ?? null,
          ip_resistivity_ohmm: payload.ip_resistivity_ohmm ?? null,
          is_synthetic: payload.is_synthetic ?? false,
          notes: payload.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Station;
    },
    [user]
  );

  const updateStation = useCallback(async (id: string, patch: Partial<Station>) => {
    const { data, error } = await supabase
      .from("geophysics_stations")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Station;
  }, []);

  const deleteStation = useCallback(async (id: string) => {
    const { error } = await supabase.from("geophysics_stations").delete().eq("id", id);
    if (error) throw error;
  }, []);

  const createLine = useCallback(
    async (projectId: string, surveyId: string, payload: Partial<Line>) => {
      if (!user) throw new Error("Sin sesión");
      const { data, error } = await supabase
        .from("geophysics_lines")
        .insert({
          project_id: projectId,
          survey_id: surveyId,
          created_by: user.id,
          line_id: payload.line_id ?? "L-NEW",
          geometry_geojson:
            payload.geometry_geojson ?? { type: "LineString", coordinates: [] },
          length_m: payload.length_m ?? null,
          is_synthetic: payload.is_synthetic ?? false,
          notes: payload.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Line;
    },
    [user]
  );

  const updateLine = useCallback(async (id: string, patch: Partial<Line>) => {
    const { data, error } = await supabase
      .from("geophysics_lines")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Line;
  }, []);

  const deleteLine = useCallback(async (id: string) => {
    const { error } = await supabase.from("geophysics_lines").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return {
    createSurvey,
    updateSurvey,
    deleteSurvey,
    createStation,
    updateStation,
    deleteStation,
    createLine,
    updateLine,
    deleteLine,
  };
}
