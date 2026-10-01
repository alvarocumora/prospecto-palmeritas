import type { DocBlock } from "@/lib/pdf/model";
import type { GeoSnapshotManifest } from "./snapshotManifest";

export type ReportMapBlock = Extract<DocBlock, { kind: "map" }>;

export function buildReportMapBlock(input: {
  title: string;
  imageDataUrl: string;
  manifest: GeoSnapshotManifest;
  caption?: string;
  imagery?: string;
}): ReportMapBlock {
  if (!input.manifest.eligibleForReport) {
    throw new Error(
      `Geo snapshot is not report-eligible: ${input.manifest.issues.join(", ") || "no report-capable layers"}`,
    );
  }

  const sources = Array.from(
    new Set(input.manifest.layers.map((layer) => layer.sourceSystem).filter(Boolean)),
  );

  return {
    kind: "map",
    title: input.title,
    imageDataUrl: input.imageDataUrl,
    caption: input.caption,
    crs: input.manifest.crs,
    imagery: input.imagery,
    snapshotManifest: input.manifest,
    source: sources.join(" · "),
  };
}
