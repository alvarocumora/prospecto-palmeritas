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

export type PublicGeoFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, unknown>;
};

export type PublicGeoFeatureCollection = {
  type: "FeatureCollection";
  features: PublicGeoFeature[];
};

export type PublicGeoLayerData = Partial<Record<CanonicalGeoLayerId, PublicGeoFeatureCollection>>;

export type PublicGeoBundle = {
  manifest: PublicGeoManifest;
  center: [number, number];
  bbox: [number, number, number, number] | null;
  layers: PublicGeoLayerData;
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

export function isCertificationEvidence(evidence: GeoEvidenceClass): boolean {
  return evidence === "OFICIAL" || evidence === "CERTIFICADO" || evidence === "MEDIDO";
}

export function publicBundleLayerIds(bundle: PublicGeoBundle): CanonicalGeoLayerId[] {
  return bundle.manifest.layers
    .map((layer) => layer.id)
    .filter((id) => id === "territory.dem" || Boolean(bundle.layers[id]));
}
