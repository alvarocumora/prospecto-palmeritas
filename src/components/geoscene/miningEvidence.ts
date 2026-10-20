import {
  getGeoLayer,
  type GeoEvidenceClass,
  type GeoLayerDomain,
} from "@/lib/geospatial/layerRegistry";
import type { GeoSceneProjectLayer } from "./projectLayers";

/**
 * This inventory uses only GeoJSON actually supplied to the viewer. It does
 * not imply any of the datasets are verified resources or measured volumes.
 */
export type MiningEvidenceRow = {
  id: string;
  label: string;
  domain: GeoLayerDomain;
  evidence: GeoEvidenceClass;
  source: string;
  caution: string | null;
  scale: string;
  units: string | null;
  featureCount: number;
  visibleByDefault: boolean;
  examples: string[];
};

const NAME_PROPERTIES = ["nombre", "name", "sample_id", "hole_id", "code", "codigo", "id"] as const;

function featureName(properties: Record<string, unknown> | null): string | null {
  if (!properties) return null;
  for (const field of NAME_PROPERTIES) {
    const value = properties[field];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function projectMiningEvidence(
  layers: readonly GeoSceneProjectLayer[] | undefined,
): MiningEvidenceRow[] {
  return (layers ?? []).flatMap((item) => {
    const registry = getGeoLayer(item.id);
    if (!registry || !Array.isArray(item.data?.features)) return [];
    const examples = item.data.features
      .map((feature) => featureName((feature.properties ?? null) as Record<string, unknown> | null))
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);
    return [
      {
        id: registry.id,
        label: registry.label,
        domain: registry.domain,
        evidence: registry.evidence,
        source: item.source?.trim() || registry.sourceSystem,
        caution: registry.caution ?? null,
        scale: registry.scaleLabel,
        units: registry.units ?? null,
        featureCount: item.data.features.length,
        visibleByDefault: item.defaultVisible !== false,
        examples,
      },
    ];
  });
}

export const MINING_EVIDENCE_DOMAINS = [
  { value: "all", label: "Todas" },
  { value: "remote_sensing", label: "Satélite" },
  { value: "sampling", label: "Muestras" },
  { value: "geophysics", label: "Geofísica" },
  { value: "drilling", label: "Sondajes" },
  { value: "territory", label: "Concesiones" },
  { value: "other", label: "Geología y otros" },
] as const;

export type MiningEvidenceFilter = (typeof MINING_EVIDENCE_DOMAINS)[number]["value"];

export function filterMiningEvidence(
  rows: readonly MiningEvidenceRow[],
  filter: MiningEvidenceFilter,
): MiningEvidenceRow[] {
  if (filter === "all") return [...rows];
  if (filter === "other") {
    return rows.filter(
      (row) =>
        !["remote_sensing", "sampling", "geophysics", "drilling", "territory"].includes(row.domain),
    );
  }
  // Laboratory assays in the geochemistry domain also belong in the Samples view.
  if (filter === "sampling") {
    return rows.filter((row) => row.domain === "sampling" || row.domain === "geochemistry");
  }
  return rows.filter((row) => row.domain === filter);
}
