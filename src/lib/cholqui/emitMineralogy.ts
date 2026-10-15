import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { geoColors } from "@/lib/geospatial/visualTokens";

/**
 * Mineralogía NASA EMIT L2B ortorrectificada con la GLT oficial y recortada al AOI del proyecto
 * por scripts/process_emit_l2bmin.py. Estimación espectral MODELADA, nunca medida.
 * Los archivos se cargan bajo demanda para no inflar el bundle inicial.
 */
type EmitCollection = FeatureCollection & {
  metadata: {
    familias: Record<string, string>;
    escenas: Array<{ adquisicion: string }>;
    filtro_oxidos?: string;
  };
};

export type EmitLayer = {
  id: string;
  label: string;
  evidence: string;
  caution: string;
  features: FeatureCollection;
  color: string;
  defaultVisible: boolean;
};

const FAMILY_COLORS: Record<string, string> = {
  alunita: geoColors.deposit,
  arcillas: geoColors.proposedEvidence,
  clorita: geoColors.terrainLow,
  carbonatos: geoColors.signal,
  oxidos: geoColors.tenureOwn,
};

const SOURCES = {
  cholqui: () => import("@/data/geo/cholqui_emit_mineralogia.json?raw"),
  losverdes: () => import("@/data/geo/losverdes_emit_mineralogia.json?raw"),
} as const;

export type EmitProject = keyof typeof SOURCES;

function formatDate(stamp: string) {
  return `${stamp.slice(6, 8)}-${stamp.slice(4, 6)}-${stamp.slice(0, 4)}`;
}

export function buildEmitLayers(emit: EmitCollection): EmitLayer[] {
  const dates = emit.metadata.escenas.map((s) => formatDate(s.adquisicion)).join(" y ");
  const caution =
    `NASA EMIT L2B v002 (${dates}), ortorrectificado con GLT oficial, píxel ~60 m. ` +
    "Estimación espectral de superficie con incertidumbre; no es ensaye, medición de terreno ni recurso.";
  return Object.entries(emit.metadata.familias).map(([key, label]) => ({
    id: `emit-${key}`,
    label: `EMIT · ${label}`,
    evidence: "MODELADO",
    caution: key === "oxidos" && emit.metadata.filtro_oxidos
      ? `${caution} ${emit.metadata.filtro_oxidos}`
      : caution,
    features: {
      type: "FeatureCollection",
      features: emit.features.filter((f) => f.properties?.familia === key),
    } as FeatureCollection,
    color: FAMILY_COLORS[key] ?? geoColors.signal,
    // Óxidos de Fe³⁺ cubren gran parte del AOI: apagados al abrir para no ocultar el resto.
    defaultVisible: key !== "oxidos",
  }));
}

export function useEmitMineralogyLayers(project: EmitProject): EmitLayer[] {
  const [layers, setLayers] = useState<EmitLayer[]>([]);
  useEffect(() => {
    let cancelled = false;
    SOURCES[project]()
      .then((mod) => {
        if (!cancelled) setLayers(buildEmitLayers(JSON.parse(mod.default) as EmitCollection));
      })
      .catch(() => {
        if (!cancelled) setLayers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);
  return layers;
}
