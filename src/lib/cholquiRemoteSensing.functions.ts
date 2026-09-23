import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CholquiRemoteCandidateCollection } from "@/features/franco/data/remoteSensing";

const Input = z.object({}).default({});

/**
 * Reads the reproducible output of geocapitals-remote when it has been published
 * by the processing pipeline. Absence is an explicit state: the UI must never
 * fabricate spectral anomalies.
 */
export const getCholquiRemoteCandidates = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d ?? {}))
  .handler(async () => {
    const url = process.env.CHOLQUI_REMOTE_CANDIDATES_URL;
    if (!url) {
      return {
        ok: false as const,
        status: "NOT_PUBLISHED" as const,
        error: "Remote-sensing candidates have not been published yet.",
        data: null,
      };
    }
    try {
      const res = await fetch(url, { headers: { Accept: "application/geo+json, application/json" } });
      if (!res.ok) {
        return { ok: false as const, status: "FETCH_ERROR" as const, error: `HTTP ${res.status}`, data: null };
      }
      const data = (await res.json()) as CholquiRemoteCandidateCollection;
      if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
        return { ok: false as const, status: "INVALID_DATA" as const, error: "Invalid GeoJSON FeatureCollection.", data: null };
      }
      return { ok: true as const, status: "PUBLISHED" as const, error: null, data };
    } catch (e) {
      return { ok: false as const, status: "FETCH_ERROR" as const, error: (e as Error).message, data: null };
    }
  });
