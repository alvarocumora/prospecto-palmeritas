/**
 * Catálogo satelital real para el AOI de Cholqui.
 *
 * Consulta el STAC público de Microsoft Planetary Computer (Sentinel-2 L2A)
 * sobre el bounding box de las pertenencias. Devuelve escenas reales
 * (id, fecha, nubosidad, preview) — NO calcula índices espectrales ni
 * "anomalías": cualquier interpretación mostrada en la UI viene de la
 * evidencia de terreno documentada, etiquetada como tal.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";

export type CholquiScene = {
  id: string;
  datetime: string;
  cloudPct: number | null;
  previewUrl: string | null;
  stacHref: string | null;
  platform: string | null;
};

export type CholquiSatelliteResult = {
  ok: boolean;
  error: string | null;
  bbox: [number, number, number, number];
  scenes: CholquiScene[];
};

const Input = z
  .object({
    monthsBack: z.number().min(1).max(36).default(12),
    maxCloud: z.number().min(1).max(100).default(25),
  })
  .default({ monthsBack: 12, maxCloud: 25 });

// Bounding box de las pertenencias de Cholqui (WGS84), con holgura.
const BBOX: [number, number, number, number] = [-71.09, -33.9, -70.99, -33.81];

export const getCholquiScenes = createServerFn({ method: "GET" })
  .inputValidator((d) => Input.parse(d ?? {}))
  .handler(async ({ data }): Promise<CholquiSatelliteResult> => {
    const to = new Date();
    const from = new Date(to.getTime() - data.monthsBack * 30 * 24 * 3600 * 1000);
    try {
      const res = await fetch(`${STAC}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: ["sentinel-2-l2a"],
          bbox: BBOX,
          datetime: `${from.toISOString()}/${to.toISOString()}`,
          query: { "eo:cloud_cover": { lt: data.maxCloud } },
          limit: 24,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `STAC ${res.status}`, bbox: BBOX, scenes: [] };
      }
      const json = (await res.json()) as {
        features?: Array<{
          id?: string;
          properties?: Record<string, unknown>;
          assets?: Record<string, { href?: string }>;
          links?: Array<{ rel?: string; href?: string }>;
        }>;
      };
      const scenes: CholquiScene[] = (json.features ?? []).map((f) => {
        const p = f.properties ?? {};
        return {
          id: String(f.id ?? ""),
          datetime: String(p["datetime"] ?? ""),
          cloudPct: typeof p["eo:cloud_cover"] === "number" ? (p["eo:cloud_cover"] as number) : null,
          previewUrl: f.assets?.["rendered_preview"]?.href ?? f.assets?.["visual"]?.href ?? null,
          stacHref: (f.links ?? []).find((l) => l?.rel === "self")?.href ?? null,
          platform: typeof p["platform"] === "string" ? (p["platform"] as string) : null,
        };
      });
      scenes.sort((a, b) => (a.datetime < b.datetime ? 1 : -1));
      return { ok: true, error: null, bbox: BBOX, scenes };
    } catch (e) {
      return { ok: false, error: (e as Error).message, bbox: BBOX, scenes: [] };
    }
  });
