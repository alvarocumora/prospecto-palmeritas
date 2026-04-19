import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DroneFlight = {
  id: string;
  project_id: string;
  campaign_id: string | null;
  name: string;
  sensor: string;
  pilot: string | null;
  flown_at: string | null;
  altitude_m: number | null;
  area_ha: number | null;
  geometry_geojson: unknown;
  notes: string | null;
};

export type DroneRaster = {
  id: string;
  project_id: string;
  campaign_id: string | null;
  flight_id: string | null;
  name: string;
  raster_type: string;
  url: string;
  bounds_geojson: unknown;
  captured_at: string | null;
};

export function useDroneFlights(projectId: string | null) {
  const [flights, setFlights] = useState<DroneFlight[]>([]);
  const [rasters, setRasters] = useState<DroneRaster[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) { setFlights([]); setRasters([]); setLoading(false); return; }
    setLoading(true);
    const [f, r] = await Promise.all([
      supabase.from("drone_flights").select("*").eq("project_id", projectId).order("flown_at", { ascending: false, nullsFirst: false }),
      supabase.from("drone_rasters").select("*").eq("project_id", projectId).order("captured_at", { ascending: false, nullsFirst: false }),
    ]);
    setFlights((f.data ?? []) as DroneFlight[]);
    setRasters((r.data ?? []) as DroneRaster[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { flights, rasters, loading, refresh };
}

export type FlightInsert = {
  project_id: string;
  campaign_id?: string | null;
  name: string;
  sensor: string;
  pilot?: string | null;
  flown_at?: string | null;
  altitude_m?: number | null;
  area_ha?: number | null;
  geometry_geojson: unknown;
  notes?: string | null;
};

export type RasterInsert = {
  project_id: string;
  campaign_id?: string | null;
  flight_id?: string | null;
  name: string;
  raster_type: string;
  url: string;
  bounds_geojson: unknown;
  captured_at?: string | null;
};

export async function createFlight(payload: FlightInsert, userId: string) {
  const row = {
    project_id: payload.project_id,
    campaign_id: payload.campaign_id ?? null,
    name: payload.name,
    sensor: payload.sensor,
    pilot: payload.pilot ?? null,
    flown_at: payload.flown_at ?? null,
    altitude_m: payload.altitude_m ?? null,
    area_ha: payload.area_ha ?? null,
    geometry_geojson: payload.geometry_geojson as never,
    notes: payload.notes ?? null,
    created_by: userId,
  };
  return supabase.from("drone_flights").insert(row).select().single();
}

export async function deleteFlight(id: string) {
  return supabase.from("drone_flights").delete().eq("id", id);
}

export async function createRaster(payload: RasterInsert, userId: string) {
  const row = {
    project_id: payload.project_id,
    campaign_id: payload.campaign_id ?? null,
    flight_id: payload.flight_id ?? null,
    name: payload.name,
    raster_type: payload.raster_type,
    url: payload.url,
    bounds_geojson: payload.bounds_geojson as never,
    captured_at: payload.captured_at ?? null,
    created_by: userId,
  };
  return supabase.from("drone_rasters").insert(row).select().single();
}

export async function deleteRaster(id: string) {
  return supabase.from("drone_rasters").delete().eq("id", id);
}
