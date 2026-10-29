import type { LosVerdesMapData, MapFeature } from "@/lib/losverdes-map.functions";
import type { LosVerdesMining } from "@/lib/losverdes-veins.functions";
import type { LosVerdesAnomalies } from "@/lib/livemap-public.functions";
import type {
  PublicGeoBundle,
  PublicGeoFeatureCollection,
  PublicGeoManifest,
} from "@/lib/geospatial/publicGeoContract";
import { multiElementProps } from "@/lib/tilama/geochem";

/** Adds Mo/As/Pb/Zn/Au and QA/QC flags from the Tilama CORE CSV, matched by sample code. */
function withMultiElement(fc: PublicGeoFeatureCollection): PublicGeoFeatureCollection {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const extra = multiElementProps(f.properties?.sample_code);
      return extra ? { ...f, properties: { ...f.properties, ...extra } } : f;
    }),
  };
}

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

function satelliteFeatures(
  anomalies: LosVerdesAnomalies | null | undefined,
  fallback: PublicGeoFeatureCollection,
): PublicGeoFeatureCollection {
  if (!anomalies) return fallback;
  return {
    type: "FeatureCollection",
    features: anomalies.satAnomalies
      .filter((anomaly) => anomaly.index_code !== "STRUCTURAL_LINEAMENTS")
      .map((anomaly) => ({
        type: "Feature" as const,
        id: anomaly.id,
        geometry: anomaly.polygon
          ? { type: "Polygon" as const, coordinates: [anomaly.polygon] }
          : { type: "Point" as const, coordinates: [anomaly.lng, anomaly.lat] },
        properties: {
          index_code: anomaly.index_code,
          severity: anomaly.severity,
          score: anomaly.score,
          area_ha: anomaly.area_ha,
        },
      })),
  };
}

function magneticFeatures(
  anomalies: LosVerdesAnomalies | null | undefined,
  fallback: PublicGeoFeatureCollection,
): PublicGeoFeatureCollection {
  if (!anomalies) return fallback;
  return {
    type: "FeatureCollection",
    features: anomalies.magTargets.map((target) => ({
      type: "Feature" as const,
      id: target.id,
      geometry: { type: "Point" as const, coordinates: [target.lng, target.lat] },
      properties: {
        name: target.name,
        mag_nt: target.mag_nt,
        rank: target.rank,
        radius_m: target.radius_m,
      },
    })),
  };
}

function lineamentFeatures(
  anomalies: LosVerdesAnomalies | null | undefined,
): PublicGeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: (anomalies?.lineaments ?? []).map((lineament) => ({
      type: "Feature" as const,
      id: lineament.id,
      geometry: {
        type: "LineString" as const,
        coordinates: lineament.path.map(([lat, lng]) => [lng, lat]),
      },
      properties: {
        severity: lineament.severity,
        score: lineament.score,
      },
    })),
  };
}

export function buildLosVerdesPublicGeoBundle(
  manifest: PublicGeoManifest,
  mapData: LosVerdesMapData,
  mining?: LosVerdesMining | null,
  anomalies?: LosVerdesAnomalies | null,
): PublicGeoBundle {
  const satFallback = featureCollection(mapData.satAnomalies.features);
  const magFallback = featureCollection(mapData.magAnomalies.features);

  return {
    manifest,
    center: mapData.center,
    bbox: mapData.bbox,
    layers: {
      "territory.cadastre": featureCollection(mapData.concessions.features),
      "remote_sensing.sentinel2_alteration": satelliteFeatures(anomalies, satFallback),
      "remote_sensing.lineaments": lineamentFeatures(anomalies),
      "geology.interpreted_structures": veinFeatures(mining),
      "geophysics.anomalies": magneticFeatures(anomalies, magFallback),
      "sampling.results": withMultiElement(featureCollection(mapData.samples.features)),
      "targets.exploration": featureCollection(mapData.targets.features),
    },
  };
}
