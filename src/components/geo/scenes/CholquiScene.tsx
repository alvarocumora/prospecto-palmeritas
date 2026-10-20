import { useMemo } from "react";
import { buildCholquiSceneInput } from "@/features/franco/cholquiSceneLayers";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";
import { useAsterS1Layers } from "@/lib/cholqui/asterS1Layers";
import type { GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import { ProjectSceneFrame } from "../UnifiedProjectScene";
import type { ProjectView } from "@/lib/projects/navigation";
import { CHOLQUI_STRUCTURES_GEOJSON } from "@/features/franco/data/cholquiStructures";
import { correlateVeins, correlationLayer, haloSummary } from "@/lib/cholqui/structuralCorrelation";

export function CholquiScene({ view }: { view: ProjectView }) {
  const input = useMemo(buildCholquiSceneInput, []);
  const emit = useEmitMineralogyLayers("cholqui");
  const radar = useAsterS1Layers();
  const correlated = useMemo(() => {
    const s1 = radar.find((layer) => layer.id === "s1-lineamientos");
    if (!s1) return null;
    const emitAll = {
      type: "FeatureCollection" as const,
      features: emit.flatMap((layer) => layer.features.features),
    };
    const results = correlateVeins(CHOLQUI_STRUCTURES_GEOJSON, s1.features, emitAll);
    return { results, layer: correlationLayer(results, s1.features) };
  }, [emit, radar]);
  const layers = useMemo<GeoSceneProjectLayer[]>(() => {
    const spectral = [...emit, ...radar.filter((layer) => layer.id === "aster-silice")];
    const lineaments = radar.find((layer) => layer.id === "s1-lineamientos");
    const byCode = new Map((correlated?.results ?? []).map((r) => [r.code, r]));
    const baseLayers = input.layers.map((layer) =>
      layer.id !== "geology.structures" || !byCode.size
        ? layer
        : {
            ...layer,
            data: {
              ...layer.data,
              features: layer.data.features.map((f) => {
                const r = byCode.get(String(f.properties?.code ?? ""));
                if (!r) return f;
                return {
                  ...f,
                  properties: {
                    ...f.properties,
                    halo_emit_300m: haloSummary(r.halo),
                    procedencia: r.lineaments.length
                      ? `Rumbo medido · ${r.lineaments.length} lineamiento(s) S1 coincidente(s)`
                      : "Rumbo medido · sin lineamiento S1 coincidente (≤250 m, Δθ≤15°)",
                  },
                };
              }),
            },
          },
    );
    return [
      ...baseLayers,
      ...(spectral.length
        ? [
            {
              id: "remote_sensing.hyperspectral" as const,
              defaultVisible: false,
              source:
                "NASA EMIT L2B GLT / ASTER TIR · estimaciones espectrales MODELADAS; no son ensayes ni recursos",
              data: {
                type: "FeatureCollection" as const,
                features: spectral.flatMap((layer) =>
                  layer.features.features.map((feature) => ({
                    ...feature,
                    properties: {
                      ...feature.properties,
                      nombre: layer.label,
                      procedencia: "modelled",
                      advertencia: layer.caution,
                    },
                  })),
                ),
              },
            },
          ]
        : []),
      ...(lineaments
        ? [
            {
              id: "remote_sensing.lineaments" as const,
              defaultVisible: false,
              data: lineaments.features,
              source: lineaments.caution,
            },
          ]
        : []),
      ...(correlated?.layer.features.length
        ? [
            {
              id: "geology.interpreted_structures" as const,
              defaultVisible: true,
              data: correlated.layer,
              source:
                "Cruce vetas medidas (Arcos/Leman) × lineamientos Sentinel-1 RTC × halos NASA EMIT",
            },
          ]
        : []),
    ];
  }, [input, emit, radar, correlated]);
  return <ProjectSceneFrame project={input.project} layers={layers} view={view} />;
}
