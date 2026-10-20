import type { StacItem } from "@/types/stac";
import type { GeoscienceDatasetDraft } from "./registryAdapter";

/**
 * Mapper puro STAC Item -> GeoscienceDatasetDraft. Sin HTTP ni auth propios
 * (eso lo hace `searchStac` en satelliteIntel.functions.ts, que ya pagina vía
 * `fetchStacFeatures` contra Planetary Computer / NASA CMR-STAC y usa este
 * mapper para cruzar cada escena al registro unificado `geoscience_datasets`).
 * Esta función se mantiene pura y sin red para seguir siendo testeable sin
 * mocks de HTTP.
 */
export function stacItemToDatasetDraft(item: StacItem, projectId: string): GeoscienceDatasetDraft {
  return {
    project_id: projectId,
    dataset_type: "remote_sensing",
    name: item.collection ? `${item.collection} · ${item.id}` : item.id,
    source_system: item.properties.platform ?? null,
    source_ref: item.id,
    crs: null,
    geometry_type: item.geometry?.type ?? null,
    bbox_wgs84: item.bbox ?? null,
    provenance: "DERIVED",
    acquisition_start: item.properties.start_datetime ?? item.properties.datetime ?? null,
    acquisition_end: item.properties.end_datetime ?? item.properties.datetime ?? null,
    resolution: item.properties.gsd != null ? { gsd_m: item.properties.gsd } : {},
    metadata: {
      stacVersion: "1.1.0",
      collection: item.collection ?? null,
      instruments: item.properties.instruments ?? null,
      cloudCoverPct: item.properties["eo:cloud_cover"] ?? null,
      assets: item.assets
        ? Object.fromEntries(
            Object.entries(item.assets).map(([key, asset]) => [
              key,
              { href: asset.href, type: asset.type ?? null, title: asset.title ?? null },
            ]),
          )
        : null,
    },
  };
}
