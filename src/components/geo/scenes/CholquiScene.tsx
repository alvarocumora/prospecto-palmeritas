import { useMemo } from "react";
import { buildCholquiSceneInput } from "@/features/franco/cholquiSceneLayers";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";
import { useAsterS1Layers } from "@/lib/cholqui/asterS1Layers";
import type { GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import { ProjectSceneFrame } from "../UnifiedProjectScene";
import type { ProjectView } from "@/lib/projects/navigation";

export function CholquiScene({ view }: { view: ProjectView }) {
  const input = useMemo(buildCholquiSceneInput, []);
  const emit = useEmitMineralogyLayers("cholqui");
  const radar = useAsterS1Layers();
  const layers = useMemo<GeoSceneProjectLayer[]>(() => {
    const spectral = [...emit, ...radar.filter((layer) => layer.id === "aster-silice")];
    const lineaments = radar.find((layer) => layer.id === "s1-lineamientos");
    return [...input.layers,
      ...(spectral.length ? [{ id: "remote_sensing.hyperspectral" as const,
        defaultVisible: false,
        source: "NASA EMIT L2B GLT / ASTER TIR · estimaciones espectrales MODELADAS; no son ensayes ni recursos",
        data: { type: "FeatureCollection" as const, features: spectral.flatMap((layer) => layer.features.features.map((feature) => ({ ...feature,
          properties: { ...feature.properties, nombre: layer.label, procedencia: "modelled", advertencia: layer.caution },
        }))) } }] : []),
      ...(lineaments ? [{ id: "remote_sensing.lineaments" as const, defaultVisible: false, data: lineaments.features, source: lineaments.caution }] : []),
    ];
  }, [input, emit, radar]);
  return <ProjectSceneFrame project={input.project} layers={layers} view={view} />;
}