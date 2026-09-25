import { canonicalAssetKey } from "@/lib/mining-asset-graph/graph";
import type { MiningAssetNode, MiningAssetNodeType } from "@/lib/mining-asset-graph/types";
import type { GeoscienceDataset } from "./types";

const nodeType: Partial<Record<GeoscienceDataset["datasetType"], MiningAssetNodeType>> = {
  geophysics: "geophysics_dataset",
  geochemistry: "geochemistry_dataset",
  assay: "assay",
  drilling: "drillhole",
  model_3d: "interpretation",
  block_model: "resource_model",
};

export function geoscienceDatasetNode(dataset: GeoscienceDataset): MiningAssetNode {
  const type = nodeType[dataset.datasetType] ?? "interpretation";
  return {
    id: `geoscience:${dataset.id}`,
    projectId: dataset.projectId,
    nodeType: type,
    canonicalKey: canonicalAssetKey(type, [dataset.datasetType, dataset.id, dataset.version]),
    entityId: dataset.id,
    label: dataset.name,
    commodity: typeof dataset.metadata.commodity === "string" ? dataset.metadata.commodity : null,
    provenance: dataset.provenance,
    confidence: dataset.qaStatus === "passed" ? 1 : dataset.qaStatus === "warning" ? 0.5 : dataset.qaStatus === "failed" || dataset.qaStatus === "synthetic" ? 0 : null,
    status: dataset.qaStatus,
    sourceRef: dataset.sourceRef,
    metadata: {
      datasetType: dataset.datasetType,
      method: dataset.method,
      crs: dataset.crs,
      verticalDatum: dataset.verticalDatum,
      units: dataset.units,
      bboxWgs84: dataset.bboxWgs84,
      version: dataset.version,
      contentHash: dataset.contentHash,
      technicalEvidence: dataset.qaStatus !== "synthetic" && dataset.qaStatus !== "failed",
    },
  };
}
