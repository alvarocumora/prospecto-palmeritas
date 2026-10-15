import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCatastroRole } from "@/lib/access/roleMiddleware";
import { validSatelliteBbox } from "@/lib/satellite/evidence";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "satellite-products";
const bboxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(validSatelliteBbox, "AOI geográfico inválido");
const scopeSchema = z.object({ projectId: z.string().uuid(), bbox: bboxSchema });
async function member(supabase: SupabaseClient<Database>, projectId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error || !data) throw new Error("PROJECT_ACCESS_DENIED");
}
export const listSentinelProcessingScenes = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) =>
    scopeSchema
      .extend({
        dateFrom: z.string().date(),
        dateTo: z.string().date(),
        maxCloud: z.number().min(0).max(100).default(20),
      })
      .refine((input) => input.dateFrom <= input.dateTo, "Periodo invertido")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await member(context.supabase, data.projectId, context.userId);
    const { searchSentinel2Scenes } = await import("@/lib/remote-sensing/sceneCatalog");
    return searchSentinel2Scenes({
      bbox: data.bbox,
      from: `${data.dateFrom}T00:00:00Z`,
      to: `${data.dateTo}T23:59:59Z`,
      maxCloudPct: data.maxCloud,
      limit: 12,
    });
  });

export const processSentinelScene = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) =>
    scopeSchema.extend({ sceneId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await member(supabase, data.projectId, userId);
    const { SENTINEL_PIPELINE, INDEX_ORDER, processSentinelRaster } =
      await import("@/lib/remote-sensing/sentinelRaster");
    const { loadSentinelRasterScene } = await import("@/lib/remote-sensing/sentinelScene.server");
    const { data: run, error: createError } = await supabase
      .from("satellite_analysis_runs")
      .insert({
        project_id: data.projectId,
        created_by: userId,
        provider: "planetary_computer",
        sensor: "sentinel-2-l2a",
        index_code: "HYDROTHERMAL_ALTERATION",
        status: "running",
        started_at: new Date().toISOString(),
        external_scene_id: data.sceneId,
        bbox: data.bbox,
        pipeline_version: SENTINEL_PIPELINE,
        parameters: {
          provenance: "modelled",
          resolution_m: 20,
          resampling: "nearest",
          scl_accepted: [4, 5],
          max_pixels: 1_000_000,
          indices: [...INDEX_ORDER],
        },
      })
      .select("id")
      .single();
    if (createError || !run) throw new Error(createError?.message ?? "RUN_CREATE_FAILED");
    const storagePath = `${data.projectId}/${userId}/${run.id}.tif`;
    const rgbStoragePath = `${data.projectId}/${userId}/${run.id}.rgb.tif`;
    let uploaded = false;
    let rgbUploaded = false;
    let previewUploaded = false;
    try {
      const signal = AbortSignal.timeout(180_000);
      const scene = await loadSentinelRasterScene(data.sceneId, signal);
      const raster = await processSentinelRaster(scene, data.bbox, signal);
      const digest = await crypto.subtle.digest("SHA-256", raster.geoTiff);
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, raster.geoTiff, { contentType: "image/tiff", upsert: false });
      if (uploadError) throw new Error(`ARTIFACT_UPLOAD_FAILED: ${uploadError.message}`);
      uploaded = true;
      const { error: rgbUploadError } = await supabase.storage
        .from(BUCKET)
        .upload(rgbStoragePath, raster.rgbGeoTiff, { contentType: "image/tiff", upsert: false });
      if (rgbUploadError) throw new Error(`RGB_UPLOAD_FAILED: ${rgbUploadError.message}`);
      rgbUploaded = true;
      const previewPath = `${data.projectId}/${userId}/${run.id}.preview.geojson`;
      const previewBlob = new Blob([JSON.stringify(raster.preview)], {
        type: "application/geo+json",
      });
      const { error: previewError } = await supabase.storage
        .from(BUCKET)
        .upload(previewPath, previewBlob, { contentType: "application/geo+json", upsert: false });
      if (previewError) throw new Error(`PREVIEW_UPLOAD_FAILED: ${previewError.message}`);
      previewUploaded = true;
      const sourceMetadata = {
        provenance: "modelled",
        preview_path: previewPath,
        stac_href: scene.stacHref,
        acquisition_date: scene.datetime,
        cloud_pct: scene.cloudPct,
        assets: Object.fromEntries(
          Object.entries(scene.assets).map(([key, asset]) => [
            key,
            {
              href: asset.href.split("?")[0],
              scale: asset.scale,
              offset: asset.offset,
              nodata: asset.nodata,
            },
          ]),
        ),
      };
      const stats = {
        grid: raster.grid,
        indices: raster.stats,
        valid_pixels: raster.validPixels,
        excluded_pixels: raster.excludedPixels,
        byte_length: raster.geoTiff.byteLength,
        bands: [...INDEX_ORDER],
        visualization: {
          storage_path: rgbStoragePath,
          bands: ["B04", "B03", "B02"],
          pixel_type: "RGBA UInt8",
          valid_pixels: raster.validPixels,
          transparent_pixels: raster.excludedPixels,
          stretch: "BOA 0–0.3 reflectance to sRGB",
        },
        units: "dimensionless",
        artifact_format: "GeoTIFF (not COG)",
        map_preview_features: raster.preview.features.length,
        interpretation:
          "Índices espectrales derivados; no identificación de minerales ni mediciones de campo",
      };
      const { error: saveError } = await supabase
        .from("satellite_analysis_runs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          storage_path: storagePath,
          content_hash: hash,
          source_metadata: sourceMetadata,
          stats,
        })
        .eq("id", run.id)
        .eq("project_id", data.projectId)
        .select("id")
        .single();
      if (saveError) throw new Error(`RUN_SAVE_FAILED: ${saveError.message}`);
      return { ok: true as const, runId: run.id, stats, hash, error: null };
    } catch (error) {
      if (uploaded) await supabase.storage.from(BUCKET).remove([storagePath]);
      if (rgbUploaded) await supabase.storage.from(BUCKET).remove([rgbStoragePath]);
      if (previewUploaded)
        await supabase.storage
          .from(BUCKET)
          .remove([`${data.projectId}/${userId}/${run.id}.preview.geojson`]);
      const message = error instanceof Error ? error.message : "PROCESSING_FAILED";
      const { error: recordError } = await supabase
        .from("satellite_analysis_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", run.id)
        .eq("project_id", data.projectId)
        .select("id")
        .single();
      if (recordError)
        throw new Error(`${message}; FAILED_STATUS_SAVE_FAILED: ${recordError.message}`);
      return { ok: false as const, runId: run.id, stats: null, hash: null, error: message };
    }
  });

export const getSentinelRasterPreview = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await member(context.supabase, data.projectId, context.userId);
    const { data: runs, error } = await context.supabase
      .from("satellite_analysis_runs")
      .select("id,created_by,status,pipeline_version")
      .eq("project_id", data.projectId)
      .eq("pipeline_version", "sentinel2-l2a-indices-v1")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    for (const run of runs ?? []) {
      const path = `${data.projectId}/${run.created_by}/${run.id}.preview.geojson`;
      const { data: file, error: fileError } = await context.supabase.storage
        .from(BUCKET)
        .download(path);
      if (fileError || !file) continue;
      const parsed = JSON.parse(await file.text()) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { type?: unknown }).type === "FeatureCollection" &&
        Array.isArray((parsed as { features?: unknown }).features)
      )
        return { runId: run.id, preview: parsed };
    }
    return { runId: null, preview: null };
  });

export const getSentinelRasterDownload = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), runId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await member(context.supabase, data.projectId, context.userId);
    const { data: run, error } = await context.supabase
      .from("satellite_analysis_runs")
      .select("id,project_id,created_by,status,storage_path,pipeline_version")
      .eq("project_id", data.projectId)
      .eq("id", data.runId)
      .single();
    if (
      error ||
      !run ||
      run.status !== "succeeded" ||
      run.pipeline_version !== "sentinel2-l2a-indices-v1" ||
      run.storage_path !== `${run.project_id}/${run.created_by}/${run.id}.tif`
    )
      throw new Error("RASTER_NOT_AVAILABLE");
    const { data: signed, error: signError } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(run.storage_path, 300, { download: `Sentinel2_${run.id}.tif` });
    if (signError || !signed) throw new Error(signError?.message ?? "DOWNLOAD_SIGN_FAILED");
    return { url: signed.signedUrl };
  });

/** Returns a short-lived, member-authorized RGB raster only when it covers the requested terrain. */
export const getSentinelRgbDrape = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) => scopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await member(context.supabase, data.projectId, context.userId);
    const { data: runs, error } = await context.supabase
      .from("satellite_analysis_runs")
      .select("id,project_id,created_by,external_scene_id,created_at,bbox,stats,source_metadata")
      .eq("project_id", data.projectId)
      .eq("pipeline_version", "sentinel2-l2a-indices-v1")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const covers = (value: unknown) => {
      if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite))
        return false;
      return (
        value[0] <= data.bbox[0] &&
        value[1] <= data.bbox[1] &&
        value[2] >= data.bbox[2] &&
        value[3] >= data.bbox[3]
      );
    };
    for (const run of runs ?? []) {
      if (!covers(run.bbox)) continue;
      const stats = run.stats as {
        visualization?: { storage_path?: unknown; valid_pixels?: unknown };
      } | null;
      const expectedPath = `${run.project_id}/${run.created_by}/${run.id}.rgb.tif`;
      if (stats?.visualization?.storage_path !== expectedPath) continue;
      const { data: signed, error: signError } = await context.supabase.storage
        .from(BUCKET)
        .createSignedUrl(expectedPath, 300);
      if (signError || !signed) continue;
      const metadata = run.source_metadata as {
        acquisition_date?: unknown;
        cloud_pct?: unknown;
      } | null;
      return {
        url: signed.signedUrl,
        sceneId: run.external_scene_id,
        acquisitionDate:
          typeof metadata?.acquisition_date === "string" ? metadata.acquisition_date : null,
        cloudPct: typeof metadata?.cloud_pct === "number" ? metadata.cloud_pct : null,
        validPixels:
          typeof stats?.visualization?.valid_pixels === "number"
            ? stats.visualization.valid_pixels
            : null,
      };
    }
    return null;
  });
