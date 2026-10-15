import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireCatastroRole } from "@/lib/access/roleMiddleware";
import type { Database } from "@/integrations/supabase/types";
import {
  assertSimpegMagneticsPayload,
  SIMPEG_MAGNETICS_SCHEMA_VERSION,
  type SimpegMagneticsPayload,
} from "@/lib/geoscience-compute/simpegMagnetics";

const BUCKET = "engine-artifacts";
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const pointSchema = z.object({
  x_m: z.number().finite(),
  y_m: z.number().finite(),
  z_m: z.number().finite(),
});
const inputSchema = z.object({
  projectId: z.string().uuid(),
  observationDatasetId: z.string().uuid(),
  topographyDatasetId: z.string().uuid(),
  crs: z.string().min(1).max(80),
  observations: z
    .array(
      z.object({
        x_m: z.number().finite(),
        y_m: z.number().finite(),
        z_m: z.number().finite(),
        tmi_nt: z.number().finite(),
        std_nt: z.number().positive().finite(),
      }),
    )
    .min(4)
    .max(50_000),
  topography: z.array(pointSchema).min(3).max(100_000),
  inducingField: z.object({
    amplitudeNt: z.number().positive().finite(),
    inclinationDeg: z.number().min(-90).max(90),
    declinationDeg: z.number().min(-360).max(360),
  }),
  mesh: z.object({
    cellSizeM: z.number().positive(),
    paddingM: z.number().nonnegative(),
    depthM: z.number().positive(),
    maxCells: z.number().int().min(1_000).max(250_000).optional(),
  }),
  inversion: z
    .object({
      maxIterations: z.number().int().min(1).max(100).optional(),
      lowerBoundSi: z.number().optional(),
      upperBoundSi: z.number().optional(),
      startingSusceptibilitySi: z.number().optional(),
      beta0Ratio: z.number().positive().optional(),
    })
    .optional(),
});

type NodeResult = {
  job_id?: string;
  project_id?: string;
  engine_version?: string;
  status?: string;
  metrics?: Record<string, number | string | boolean | null>;
  artifact?: {
    filename?: string;
    sha256?: string;
    content_type?: string;
    byte_length?: number;
    base64?: string;
  };
};

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("GEOSCIENCE_STORAGE_NOT_CONFIGURED");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const runSimpegMagneticInversion = createServerFn({ method: "POST" })
  .middleware([requireCatastroRole])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isMember, error: membershipError } = await context.supabase.rpc(
      "is_project_member",
      {
        _project_id: data.projectId,
        _user_id: context.userId,
      },
    );
    if (membershipError || !isMember) throw new Error("PROJECT_ACCESS_DENIED");

    const { data: datasets, error: datasetsError } = await context.supabase
      .from("geoscience_datasets")
      .select("id,project_id,dataset_type,crs,provenance,qa_status,content_hash")
      .eq("project_id", data.projectId)
      .in("id", [data.observationDatasetId, data.topographyDatasetId]);
    if (datasetsError) throw new Error(`GEOSCIENCE_DATASET_LOOKUP_FAILED:${datasetsError.message}`);
    const observationDataset = datasets?.find(
      (dataset) => dataset.id === data.observationDatasetId,
    );
    const topographyDataset = datasets?.find((dataset) => dataset.id === data.topographyDatasetId);
    const usable = (dataset: typeof observationDataset) =>
      !!dataset &&
      dataset.qa_status !== "synthetic" &&
      dataset.qa_status !== "failed" &&
      !!dataset.content_hash;
    if (!usable(observationDataset) || observationDataset?.dataset_type !== "geophysics") {
      throw new Error("SIMPEG_OBSERVATION_DATASET_MUST_BE_REGISTERED_NON_SYNTHETIC_AND_HASHED");
    }
    if (!usable(topographyDataset) || topographyDataset?.dataset_type !== "dem") {
      throw new Error("SIMPEG_TOPOGRAPHY_DATASET_MUST_BE_REGISTERED_NON_SYNTHETIC_AND_HASHED");
    }
    if (observationDataset.crs !== data.crs || topographyDataset.crs !== data.crs) {
      throw new Error("SIMPEG_INPUT_DATASET_CRS_MISMATCH");
    }

    const nodeUrl = process.env.SIMPEG_MAGNETICS_URL?.replace(/\/+$/, "");
    const nodeToken = process.env.SIMPEG_MAGNETICS_TOKEN;
    if (!nodeUrl || !nodeToken) throw new Error("SIMPEG_MAGNETICS_NODE_NOT_CONFIGURED");

    const jobId = crypto.randomUUID();
    const payload: SimpegMagneticsPayload = {
      schema_version: SIMPEG_MAGNETICS_SCHEMA_VERSION,
      job_id: jobId,
      project_id: data.projectId,
      crs: data.crs,
      observations: data.observations,
      topography: data.topography,
      inducing_field: {
        amplitude_nt: data.inducingField.amplitudeNt,
        inclination_deg: data.inducingField.inclinationDeg,
        declination_deg: data.inducingField.declinationDeg,
      },
      mesh: {
        cell_size_m: data.mesh.cellSizeM,
        padding_m: data.mesh.paddingM,
        depth_m: data.mesh.depthM,
        ...(data.mesh.maxCells ? { max_cells: data.mesh.maxCells } : {}),
      },
      ...(data.inversion
        ? {
            inversion: {
              ...(data.inversion.maxIterations
                ? { max_iterations: data.inversion.maxIterations }
                : {}),
              ...(data.inversion.lowerBoundSi != null
                ? { lower_bound_si: data.inversion.lowerBoundSi }
                : {}),
              ...(data.inversion.upperBoundSi != null
                ? { upper_bound_si: data.inversion.upperBoundSi }
                : {}),
              ...(data.inversion.startingSusceptibilitySi != null
                ? { starting_susceptibility_si: data.inversion.startingSusceptibilitySi }
                : {}),
              ...(data.inversion.beta0Ratio != null
                ? { beta0_ratio: data.inversion.beta0Ratio }
                : {}),
            },
          }
        : {}),
    };
    assertSimpegMagneticsPayload(payload);
    const inputDigest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const inputHash = Array.from(new Uint8Array(inputDigest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const admin = serviceClient();
    const { error: insertError } = await admin.from("geoscience_compute_jobs").insert({
      id: jobId,
      project_id: data.projectId,
      job_type: "magnetic_inversion",
      engine: "simpeg",
      engine_version: "simpeg-magnetics-v1",
      status: "running",
      created_by: context.userId,
      started_at: new Date().toISOString(),
      inputs: [
        {
          datasetId: observationDataset.id,
          contentHash: observationDataset.content_hash,
          role: "magnetic_observations",
          observationCount: data.observations.length,
          submittedPayloadHash: inputHash,
        },
        {
          datasetId: topographyDataset.id,
          contentHash: topographyDataset.content_hash,
          role: "topography",
          pointCount: data.topography.length,
          submittedPayloadHash: inputHash,
        },
      ],
      parameters: {
        provenance: "modelled",
        inducing_field: payload.inducing_field,
        mesh: payload.mesh,
        inversion: payload.inversion ?? {},
      },
    });
    if (insertError) throw new Error(`GEOSCIENCE_JOB_CREATE_FAILED:${insertError.message}`);

    let artifactPath: string | null = null;
    try {
      const response = await fetch(`${nodeUrl}/v1/magnetic-inversion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nodeToken}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30 * 60 * 1000),
      });
      if (!response.ok)
        throw new Error(`SIMPEG_NODE_${response.status}:${(await response.text()).slice(0, 500)}`);
      const result = (await response.json()) as NodeResult;
      if (
        result.status !== "succeeded" ||
        result.job_id !== jobId ||
        result.project_id !== data.projectId
      ) {
        throw new Error("SIMPEG_JOB_RESPONSE_IDENTITY_MISMATCH");
      }
      const encoded = result.artifact?.base64;
      if (!encoded || !result.artifact?.sha256 || !result.metrics)
        throw new Error("SIMPEG_RESULT_CONTRACT_INVALID");
      const binary = atob(encoded);
      if (binary.length > MAX_ARTIFACT_BYTES) throw new Error("SIMPEG_ARTIFACT_TOO_LARGE");
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const actualHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (actualHash !== result.artifact.sha256) throw new Error("SIMPEG_ARTIFACT_HASH_MISMATCH");

      artifactPath = `${data.projectId}/${jobId}/magnetic_inversion.npz`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(artifactPath, bytes, {
        contentType: "application/x-npz",
        upsert: false,
      });
      if (uploadError) throw new Error(`SIMPEG_ARTIFACT_UPLOAD_FAILED:${uploadError.message}`);
      const completedAt = new Date().toISOString();
      const outputs = [
        {
          role: "susceptibility_model_and_predicted_tmi",
          uri: `${BUCKET}/${artifactPath}`,
          contentHash: actualHash,
          contentType: "application/x-npz",
          byteLength: bytes.length,
        },
      ];
      const { error: updateError } = await admin
        .from("geoscience_compute_jobs")
        .update({
          status: "succeeded",
          completed_at: completedAt,
          engine_version: result.engine_version ?? "simpeg-magnetics-v1",
          outputs,
          metrics: result.metrics,
        })
        .eq("id", jobId)
        .eq("project_id", data.projectId);
      if (updateError) throw new Error(`GEOSCIENCE_JOB_UPDATE_FAILED:${updateError.message}`);
      return {
        jobId,
        status: "succeeded" as const,
        metrics: result.metrics,
        artifact: { sha256: actualHash, byteLength: bytes.length },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 1_000) : "SIMPEG_INVERSION_FAILED";
      if (artifactPath) await admin.storage.from(BUCKET).remove([artifactPath]);
      await admin
        .from("geoscience_compute_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString(), error: message })
        .eq("id", jobId)
        .eq("project_id", data.projectId);
      throw error;
    }
  });
