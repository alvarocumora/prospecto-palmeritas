import type { FeatureCollection } from "geojson";
import {
  getGeoLayer,
  type CanonicalGeoLayerId,
  type GeoEvidenceClass,
  type GeoLayerDefinition,
} from "@/lib/geospatial/layerRegistry";
import type { CadTerrainTile } from "@/lib/geospatial/terrainTile";

/**
 * Project-supplied GeoJSON layers for GeoScene3D (cadastre, pedimentos, hitos…).
 * Evidence class and caution always come from the canonical registry, never from
 * the caller, so a declared layer can't be relabelled as official.
 */
export type GeoSceneProjectLayer = {
  id: CanonicalGeoLayerId;
  data: FeatureCollection;
  /** Optional dataset source line (e.g. "KML del titular"). */
  source?: string;
};

export type GeoSceneProject = {
  id: string;
  name?: string;
  /** [lng, lat] WGS84 */
  center: [number, number];
  bbox?: [number, number, number, number] | null;
  /**
   * CAD-derived terrain. Replaces the global DEM inside the scene (never fused),
   * rendered only where the coverage mask is supported.
   */
  cadTerrain?: { tile: CadTerrainTile; notice: string };
};

export type ResolvedProjectLayer = GeoSceneProjectLayer & { definition: GeoLayerDefinition };

type Rgba = [number, number, number, number];

const EVIDENCE_COLOR: Record<GeoEvidenceClass, Rgba> = {
  OFICIAL: [37, 99, 235, 230],
  CERTIFICADO: [22, 163, 74, 230],
  MEDIDO: [22, 163, 74, 230],
  DERIVADO: [14, 165, 233, 220],
  INTERPRETADO: [168, 85, 247, 220],
  PROPUESTO: [245, 158, 11, 230],
  CONTEXTO: [148, 163, 184, 220],
};

export function evidenceColor(evidence: GeoEvidenceClass): Rgba {
  return EVIDENCE_COLOR[evidence];
}

/** Proposed or contextual layers render dashed so they never read as tenure. */
export function isDashedEvidence(evidence: GeoEvidenceClass): boolean {
  return evidence === "PROPUESTO" || evidence === "CONTEXTO";
}

export function resolveProjectLayers(
  layers: readonly GeoSceneProjectLayer[] | undefined,
): ResolvedProjectLayer[] {
  return (layers ?? []).flatMap((layer) => {
    const definition = getGeoLayer(layer.id);
    if (!definition || !layer.data?.features?.length) return [];
    return [{ ...layer, definition }];
  });
}

const NAME_KEYS = ["nombre", "name", "NOMBRE", "code", "codigo", "concesion", "id"];

export function featureLabel(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return "Elemento";
  for (const key of NAME_KEYS) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "Elemento";
}

export function projectLayerTooltip(
  layer: ResolvedProjectLayer,
  properties: Record<string, unknown> | null | undefined,
): string {
  const d = layer.definition;
  const lines = [
    featureLabel(properties),
    `${d.label} · ${d.evidence}`,
    `Fuente: ${layer.source ?? (properties?.fuente as string | undefined) ?? d.sourceSystem}`,
  ];
  if (d.caution) lines.push(d.caution);
  return lines.join("\n");
}
