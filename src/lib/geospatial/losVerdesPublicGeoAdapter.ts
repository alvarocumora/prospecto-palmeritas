import type { LosVerdesMapData, MapFeature } from "@/lib/losverdes-map.functions";
import type { LosVerdesMining } from "@/lib/losverdes-veins.functions";
import type {
  PublicGeoBundle,
  PublicGeoFeatureCollection,
  PublicGeoManifest,
} from "@/lib/geospatial/publicGeoContract";

function featureCollection(features: MapFeature[]): PublicGeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      id: feature.id,
      geometry: feature.geometry,
      properties: feature.properties,
    })),
  };
}

function veinFeatures(mining: LosVerdesMining | null | undefined): PublicGeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: (mining?.veins ?? []).flatMap((vein) => {
      if (!vein.geometry) return [];
      return [
        {
          type: "Feature" as const,
          id: vein.id,
          geometry: vein.geometry,
          properties: {
            code: vein.code,
            name: vein.name,
            commodity: vein.commodity,
            strike_deg: vein.strike_deg,
            dip_deg: vein.dip_deg,
            thickness_m: vein.thickness_m,
            confidence: vein.confidence,
          },
        },
      ];
    }),
  };
}

export function buildLosVerdesPublicGeoBundle(
  manifest: PublicGeoManifest,
  mapData: LosVerdesMapData,
  mining?: LosVerdesMining | null,
): PublicGeoBundle {
  return {
    manifest,
    center: mapData.center,
    bbox: mapData.bbox,
    layers: {
      "territory.cadastre": featureCollection(mapData.concessions.features),
      "remote_sensing.sentinel2_alteration": featureCollection(mapData.satAnomalies.features),
      "geology.structures": veinFeatures(mining),
      "geophysics.anomalies": featureCollection(mapData.magAnomalies.features),
      "sampling.results": featureCollection(mapData.samples.features),
      "targets.exploration": featureCollection(mapData.targets.features),
    },
  };
}
