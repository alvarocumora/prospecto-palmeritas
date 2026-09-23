import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CholquiRemoteCandidateCollection } from "@/features/franco/data/remoteSensing";

const Input = z.object({}).default({});

const Candidate = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
  }),
  properties: z.object({
    rank: z.number().int().positive(),
    aloh_zscore: z.number().finite(),
    aloh_percentile: z.number().finite().min(0).max(100),
    fe_oxides: z.number().finite().nullable().optional(),
    ferrous: z.number().finite().nullable().optional(),
    aloh: z.number().finite().nullable().optional(),
    gossan: z.number().finite().nullable().optional(),
    kind: z.literal("sampling_candidate"),
    legend: z.string().max(1000),
  }),
});

const CandidateCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(Candidate).max(5000),
}).passthrough();

/**
 * Reads the reproducible output of geocapitals-remote when it has been published.
 * Absence or malformed output is explicit: the UI never fabricates anomalies.
 */
export const getCholquiRemoteCandidates = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d ?? {}))
  .handler(async () => {
    const url = process.env.CHOLQUI_REMOTE_CANDIDATES_URL;
    if (!url) {
      return { ok: false as const, status: "NOT_PUBLISHED" as const, error: "Remote-sensing candidates have not been published yet.", data: null };
    }
    try {
      const res = await fetch(url, { headers: { Accept: "application/geo+json, application/json" } });
      if (!res.ok) return { ok: false as const, status: "FETCH_ERROR" as const, error: `HTTP ${res.status}`, data: null };
      const parsed = CandidateCollection.safeParse(await res.json());
      if (!parsed.success) {
        return { ok: false as const, status: "INVALID_DATA" as const, error: parsed.error.issues.slice(0, 3).map(i => `${i.path.join(".")}: ${i.message}`).join("; "), data: null };
      }
      return { ok: true as const, status: "PUBLISHED" as const, error: null, data: parsed.data as CholquiRemoteCandidateCollection };
    } catch (e) {
      return { ok: false as const, status: "FETCH_ERROR" as const, error: (e as Error).message, data: null };
    }
  });
