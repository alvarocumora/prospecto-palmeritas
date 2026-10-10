import type { PublicGeoLayerManifestEntry } from "./publicGeoContract";

/** Entity evidence overrides a layer default; a synthetic row never inherits MEDIDO. */
export function featureEvidence(
  meta: PublicGeoLayerManifestEntry,
  properties: Record<string, unknown>,
): string {
  const provenance = String(properties.provenance ?? properties.procedencia ?? "").toLowerCase();
  if (properties.is_synthetic === true || /synthetic|sintético|conceptual/.test(provenance))
    return "CONCEPTUAL";
  if (provenance === "declared" || properties.tenencia_procedencia === "declared")
    return "DECLARADO";
  if (provenance === "modelled") return "MODELADO";
  if (meta.id === "sampling.results" && properties.record_status !== "approved") return "DECLARADO";
  return meta.evidence;
}

export function primaryFeatureEvidence(
  meta: PublicGeoLayerManifestEntry,
  properties: Record<string, unknown>,
): boolean {
  return ["OFICIAL", "MEDIDO", "CERTIFICADO"].includes(featureEvidence(meta, properties));
}
