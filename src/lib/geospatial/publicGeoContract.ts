import {
  getGeoLayer,
  getGeoViewerPreset,
  type CanonicalGeoLayerId,
  type GeoEvidenceClass,
  type GeoLayerDomain,
} from "./layerRegistry";

export type PublicGeoProjectRef = {
  id: string;
  name: string;
  center_lat: number | null;
  center_lng: number | null;
};

export type PublicGeoLayerManifestEntry = {
  id: CanonicalGeoLayerId;
  label: string;
  domain: GeoLayerDomain;
  evidence: GeoEvidenceClass;
  sourceSystem: string;
  scaleLabel: string;
  caution: string | null;
};

export type PublicGeoManifest = {
  schemaVersion: 1;
  presetId: "public_live";
  project: PublicGeoProjectRef;
  layers: PublicGeoLayerManifestEntry[];
};

export function buildPublicGeoManifest(
  project: PublicGeoProjectRef,
  requestedLayerIds?: readonly CanonicalGeoLayerId[],
): PublicGeoManifest {
  const preset = getGeoViewerPreset("public_live");
  const ids = requestedLayerIds ?? preset.enabled;

  const layers = ids.map((id) => {
    const definition = getGeoLayer(id);
    if (!definition) throw new Error(`Unknown public geospatial layer: ${id}`);
    if (!definition.capabilities.includes("public")) {
      throw new Error(`Layer is not public-capable: ${id}`);
    }
    return {
      id,
      label: definition.label,
      domain: definition.domain,
      evidence: definition.evidence,
      sourceSystem: definition.sourceSystem,
      scaleLabel: definition.scaleLabel,
      caution: definition.caution ?? null,
    };
  });

  return {
    schemaVersion: 1,
    presetId: "public_live",
    project,
    layers,
  };
}
