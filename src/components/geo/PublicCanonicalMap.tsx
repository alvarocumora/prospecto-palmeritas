import { featureEvidence } from "@/lib/geospatial/featureEvidence";
import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer } from "./ProjectMasterViewer";
import type { PublicGeoBundle } from "@/lib/geospatial/publicGeoContract";

/** Public evidence adapter; the map engine is shared with the terminal and workspace. */
export function PublicCanonicalMap({
  bundle,
  height = 620,
}: {
  bundle: PublicGeoBundle;
  height?: number;
}) {
  const contextLayers = useMemo(
    () =>
      bundle.manifest.layers
        .filter((meta) => meta.id !== "territory.cadastre")
        .map((meta) => ({
          id: meta.id,
          label: meta.label,
          evidence: (() => {
            const evidence = new Set(
              (bundle.layers[meta.id]?.features ?? []).map((feature) =>
                featureEvidence(meta, feature.properties),
              ),
            );
            return evidence.size === 1
              ? [...evidence][0]
              : evidence.size
                ? "MIXTO · ver procedencia por entidad"
                : meta.evidence;
          })(),
          features: (bundle.layers[meta.id] ?? {
            type: "FeatureCollection",
            features: [],
          }) as FeatureCollection,
          evidenceForFeature: (properties: Record<string, unknown>) =>
            featureEvidence(meta, properties),
          caution: meta.caution,
        })),
    [bundle],
  );
  return (
    <ProjectMasterViewer
      projectName={bundle.manifest.project.name}
      center={{ lat: bundle.center[1], lng: bundle.center[0] }}
      concessions={bundle.layers["territory.cadastre"] as FeatureCollection | undefined}
      contextLayers={contextLayers}
      height={height}
      enableLayerTools
      spectralFootprintsOnly
    />
  );
}
