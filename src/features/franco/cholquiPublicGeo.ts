import type { FeatureCollection } from "geojson";
import concessionsRaw from "@/data/geo/cholqui_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/cholqui_satellite_candidates.geojson?raw";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import pedimentosRaw from "@/data/geo/cholqui_pedimentos.geojson?raw";
import franjasRaw from "@/data/geo/cholqui_franjas.geojson?raw";
import yacimientosRaw from "@/data/geo/cholqui_yacimientos.geojson?raw";
import pedimentosPendientesRaw from "@/data/geo/cholqui_pedimentos_pendientes.geojson?raw";
import mojonesRaw from "@/data/geo/cholqui_mojones.geojson?raw";

import { CHOLQUI, CHOLQUI_ASSAYS, CHOLQUI_POINTS } from "./data/cholqui";
import { CHOLQUI_STRUCTURES_GEOJSON } from "./data/cholquiStructures";
import { polygonCentroid } from "@/lib/cholqui/drillGrid";
import {
  anomalySurfaceToFeatureCollection,
  buildAnomalySurface,
} from "@/lib/geoscience/anomalySurface";
import {
  buildPublicGeoManifest,
  type PublicGeoBundle,
  type PublicGeoFeatureCollection,
} from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";

function parse(raw: string): PublicGeoFeatureCollection {
  const parsed = JSON.parse(raw) as FeatureCollection;
  return {
    type: "FeatureCollection",
    features: parsed.features.map((feature, index) => ({
      type: "Feature" as const,
      id: feature.id ?? index,
      geometry: feature.geometry,
      properties: (feature.properties ?? {}) as Record<string, unknown>,
    })),
  };
}

function asPublicCollection(collection: FeatureCollection): PublicGeoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature, index) => ({
      type: "Feature" as const,
      id: feature.id ?? index,
      geometry: feature.geometry,
      properties: (feature.properties ?? {}) as Record<string, unknown>,
    })),
  };
}

function bboxFromLayers(
  layers: Partial<Record<CanonicalGeoLayerId, PublicGeoFeatureCollection>>,
): [number, number, number, number] | null {
  const coords: [number, number][] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push([Number(value[0]), Number(value[1])]);
      return;
    }
    for (const child of value) walk(child);
  };

  for (const collection of Object.values(layers)) {
    for (const feature of collection?.features ?? []) {
      if (feature.geometry && "coordinates" in feature.geometry) {
        walk(feature.geometry.coordinates);
      }
    }
  }
  if (!coords.length) return null;

  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function norm(value: string): string {
  return value.replace(/[-\s]/g, "").toUpperCase();
}

function certifiedAssays(): PublicGeoFeatureCollection {
  const assayByCode = new Map(CHOLQUI_ASSAYS.map((assay) => [norm(assay.sample), assay]));
  return {
    type: "FeatureCollection",
    features: CHOLQUI_POINTS.flatMap((point) => {
      const assay = assayByCode.get(norm(point.code));
      if (!assay) return [];
      return [
        {
          type: "Feature" as const,
          id: point.code,
          geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
          properties: {
            code: point.code,
            name: point.name,
            cu_total_pct: assay.cuTotalPct,
            cu_soluble_pct: assay.cuSolublePct,
            au_gpt: assay.auGpt,
            ag_gpt: assay.agPpm,
            lab: assay.lab,
            report_id: assay.reportId,
            report_date: assay.reportDate,
          },
        },
      ];
    }),
  };
}

/**
 * Reinterpola el MISMO remote_sensing.sentinel2_alteration (z_score por
 * anomalía) sobre una grilla continua — igual algoritmo que usaba
 * ProjectMasterViewer (halosIntensidad). No vuelve a tocar Sentinel-2; es
 * visualización derivada de datos que ya están en el bundle.
 */
function anomalyIntensityCollection(
  anomalies: FeatureCollection,
): PublicGeoFeatureCollection | null {
  const points = anomalies.features.flatMap((feature) => {
    const centroid = polygonCentroid(feature.geometry);
    const zScore = Number(feature.properties?.z_score ?? feature.properties?.score);
    if (!centroid || !Number.isFinite(zScore)) return [];
    return [{ lat: centroid.lat, lng: centroid.lng, value: zScore }];
  });
  const surface = buildAnomalySurface(points, { unit: "z-score" });
  if (!surface) return null;
  return anomalySurfaceToFeatureCollection(surface) as PublicGeoFeatureCollection;
}

export function buildCholquiPublicGeoBundle(): PublicGeoBundle {
  const anomalies = JSON.parse(anomaliesRaw) as FeatureCollection;
  const intensity = anomalyIntensityCollection(anomalies);

  const layers: PublicGeoBundle["layers"] = {
    // Primero: debe quedar DEBAJO de los demás layers en el orden de render
    // de PublicCanonicalMap (itera bundle.manifest.layers en este orden).
    ...(intensity ? { "remote_sensing.anomaly_intensity": intensity } : {}),
    "territory.cadastre": parse(concessionsRaw),
    "territory.pending_pedimentos": parse(pedimentosPendientesRaw),
    "territory.mojones": parse(mojonesRaw),
    "territory.proposed_pedimentos": parse(pedimentosRaw),
    "remote_sensing.sentinel2_alteration": asPublicCollection(anomalies),
    "geology.structures": asPublicCollection(CHOLQUI_STRUCTURES_GEOJSON),
    "geology.metallogenic_belts": parse(franjasRaw),
    "geology.known_deposits": parse(yacimientosRaw),
    "sampling.assays": certifiedAssays(),
    "drilling.proposed": parse(drillRaw),
  };

  const requested = Object.keys(layers) as CanonicalGeoLayerId[];
  const project = {
    id: CHOLQUI.ref,
    name: CHOLQUI.name,
    center_lat: CHOLQUI.center.lat,
    center_lng: CHOLQUI.center.lng,
  };

  return {
    manifest: buildPublicGeoManifest(project, requested),
    center: [CHOLQUI.center.lng, CHOLQUI.center.lat],
    bbox: bboxFromLayers(layers),
    layers,
  };
}
