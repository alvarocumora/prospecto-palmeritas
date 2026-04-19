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
  storage_path: string | null;
  crs: string | null;
  pixel_size_m: number | null;
  width_px: number | null;
  height_px: number | null;
  band_count: number | null;
  min_value: number | null;
  max_value: number | null;
  file_size_bytes: number | null;
  processing: boolean;
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
  storage_path?: string | null;
  processing?: boolean;
  file_size_bytes?: number | null;
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
    storage_path: payload.storage_path ?? null,
    processing: payload.processing ?? false,
    file_size_bytes: payload.file_size_bytes ?? null,
    created_by: userId,
  };
  return supabase.from("drone_rasters").insert(row).select().single();
}

export async function deleteRaster(id: string) {
  // Best-effort: also remove file from storage if storage_path set
  const { data: row } = await supabase.from("drone_rasters").select("storage_path").eq("id", id).single();
  if (row?.storage_path) {
    await supabase.storage.from("drone-rasters").remove([row.storage_path]);
  }
  return supabase.from("drone_rasters").delete().eq("id", id);
}

/** Upload a raster file to Storage, create the DB row, and trigger metadata extraction. */
export async function uploadRasterFile(opts: {
  projectId: string;
  userId: string;
  file: File;
  name: string;
  rasterType: string;
  flightId?: string | null;
  capturedAt?: string | null;
  onProgress?: (p: number) => void;
}): Promise<{ data: DroneRaster | null; error: string | null }> {
  const { projectId, userId, file, name, rasterType, flightId, capturedAt } = opts;

  // 1. Upload to Storage at {projectId}/{timestamp}-{filename}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${projectId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("drone-rasters")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { data: null, error: `Upload: ${upErr.message}` };

  // 2. Get public URL (bucket is private — we use signed URL in render layer; here we store path-derived URL placeholder)
  const { data: signed } = await supabase.storage.from("drone-rasters").createSignedUrl(path, 60 * 60 * 24 * 7);
  const url = signed?.signedUrl ?? "";

  // 3. Insert DB row with processing=true
  const { data: row, error: insErr } = await createRaster(
    {
      project_id: projectId,
      flight_id: flightId ?? null,
      name,
      raster_type: rasterType,
      url,
      bounds_geojson: null,
      captured_at: capturedAt ?? null,
      storage_path: path,
      processing: true,
      file_size_bytes: file.size,
    },
    userId,
  );
  if (insErr || !row) return { data: null, error: `Insert: ${insErr?.message}` };

  // 4. Trigger metadata extraction (non-blocking on UI but we await for fresh data)
  try {
    await supabase.functions.invoke("extract-raster-metadata", {
      body: { rasterId: row.id, bucket: "drone-rasters", path },
    });
  } catch (e) {
    console.warn("[uploadRasterFile] metadata extraction failed:", e);
    // Mark not processing so the user isn't stuck
    await supabase.from("drone_rasters").update({ processing: false }).eq("id", row.id);
  }

  return { data: row as DroneRaster, error: null };
}

/** Fetch a fresh signed URL for a stored raster (for in-map rendering). */
export async function getRasterSignedUrl(storagePath: string, expiresIn = 60 * 60): Promise<string | null> {
  const { data } = await supabase.storage.from("drone-rasters").createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}
