import type { FeatureCollection } from "geojson";
import { geoColors } from "@/lib/geospatial/visualTokens";
import emitRaw from "@/data/geo/cholqui_emit_mineralogia.json?raw";

/**
 * Mineralogía NASA EMIT L2B (ene 2023) ortorrectificada con la GLT oficial y recortada al AOI
 * de Cholqui por scripts/process_emit_l2bmin.py. Estimación espectral MODELADA, nunca medida.
 */
type EmitCollection = FeatureCollection & {
  metadata: { familias: Record<string, string>; aviso: string };
};

const emit = JSON.parse(emitRaw) as EmitCollection;

const FAMILY_COLORS: Record<string, string> = {
  alunita: geoColors.deposit,
  arcillas: geoColors.proposedEvidence,
  clorita: geoColors.terrainLow,
  carbonatos: geoColors.signal,
  oxidos: geoColors.tenureOwn,
};

const CAUTION =
  "NASA EMIT L2B v002 (7 y 12 ene 2023), ortorrectificado con GLT oficial, píxel ~60 m. " +
  "Estimación espectral de superficie con incertidumbre; no es ensaye, medición de terreno ni recurso.";

export const cholquiEmitLayers = Object.entries(emit.metadata.familias).map(([key, label]) => ({
  id: `emit-${key}`,
  label: `EMIT · ${label}`,
  evidence: "MODELADO",
  caution: CAUTION,
  features: {
    type: "FeatureCollection",
    features: emit.features.filter((f) => f.properties?.familia === key),
  } as FeatureCollection,
  color: FAMILY_COLORS[key] ?? geoColors.signal,
}));
