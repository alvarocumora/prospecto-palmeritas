import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FeatureCollection } from "geojson";
import { GeoScene3D } from "@/components/geoscene/GeoScene3D";
import { SceneErrorBoundary } from "@/components/geoscene/SceneErrorBoundary";
import { bundleSceneLayers } from "@/components/geoscene/bundleAdapter";
import type { GeoSceneProject, GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import type { ProjectView } from "@/lib/projects/navigation";
import type { CanonicalProjectSlug } from "@/lib/projects/catalog";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { getLosVerdesMining } from "@/lib/losverdes-veins.functions";
import { getLosVerdesAnomalies } from "@/lib/livemap-public.functions";
import { usePalmerasLayers } from "@/features/palmeras/usePalmerasLayers";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";
import { useOfficialGeology } from "@/lib/geology/officialGeologicalMap";

const CholquiScene = lazy(() =>
  import("./scenes/CholquiScene").then((m) => ({ default: m.CholquiScene })),
);
const NahuelbutaScene = lazy(() =>
  import("./scenes/NahuelbutaScene").then((m) => ({ default: m.NahuelbutaScene })),
);

export function ProjectSceneFrame({
  project,
  layers,
  view,
  onViewChange,
}: {
  project: GeoSceneProject;
  layers: GeoSceneProjectLayer[];
  view: ProjectView;
  onViewChange?: (view: ProjectView) => void;
}) {
  const official = useOfficialGeology(project.center, project.bbox);
  const allLayers = useMemo<GeoSceneProjectLayer[]>(() => {
    const d = official.data;
    if (!d) return layers;
    const src = `SERNAGEOMIN · ${d.sheets.map((s) => s.label).join(", ")} (Geoportal CIGeo)`;
    return [
      ...layers,
      ...(d.units.features.length
        ? [
            {
              id: "geology.official_map_units" as const,
              data: d.units,
              source: src,
              defaultVisible: false,
            },
          ]
        : []),
      ...(d.faults.features.length
        ? [
            {
              id: "geology.official_faults" as const,
              data: d.faults,
              source: src,
              defaultVisible: false,
            },
          ]
        : []),
    ];
  }, [layers, official.data]);
  return (
    <div
      data-surface="canvas"
      className="relative h-[min(78vh,900px)] min-h-[520px] w-full overflow-hidden"
    >
      <SceneErrorBoundary label={project.name} key={project.id}>
        <GeoScene3D
          key={project.id}
          project={project}
          projectLayers={allLayers}
          view={view}
          onViewChange={onViewChange}
          showModeTabs
          showCopilot={false}
        />
      </SceneErrorBoundary>
    </div>
  );
}

/** Both public terminals and workspaces share these adapters and one renderer. */
export function UnifiedProjectScene({
  slug,
  view,
  onViewChange,
}: {
  slug: CanonicalProjectSlug;
  view: ProjectView;
  onViewChange?: (view: ProjectView) => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="h-[620px] grid place-items-center text-content-subtle">
          Cargando proyecto…
        </div>
      }
    >
      {slug === "cholqui" ? (
        <CholquiScene view={view} onViewChange={onViewChange} />
      ) : slug === "losverdes" ? (
        <LosVerdesScene view={view} onViewChange={onViewChange} />
      ) : slug === "nahuelbuta" ? (
        <NahuelbutaScene view={view} onViewChange={onViewChange} />
      ) : (
        <PalmerasScene view={view} onViewChange={onViewChange} />
      )}
    </Suspense>
  );
}

const LOSVERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

/** Centro aproximado de Tilama — placeholder mientras carga la consulta real,
 * para que la cabecera (Planta/Perspectiva, Capas) no dependa de la carga de
 * datos y aparezca de inmediato, igual que en las demás escenas. */
const LOSVERDES_FALLBACK_PROJECT: GeoSceneProject = {
  id: LOSVERDES_PROJECT_ID,
  name: "Los Verdes",
  center: [-71, -32],
};

// Capas derivadas/propuestas que saturan la vista inicial (aros satelitales,
// lineamientos, anomalías geofísicas interpretadas, sondajes conceptuales):
// quedan disponibles desde el panel de capas pero apagadas por defecto, para
// que el mapa arranque mostrando tenencia + muestras + targets.
const LOSVERDES_DEFAULT_HIDDEN = new Set<string>([
  "remote_sensing.sentinel2_alteration",
  "remote_sensing.lineaments",
  "geophysics.anomalies",
  "drilling.proposed",
]);

function LosVerdesScene({
  view,
  onViewChange,
}: {
  view: ProjectView;
  onViewChange?: (view: ProjectView) => void;
}) {
  const emit = useEmitMineralogyLayers("losverdes");
  const fetchData = useServerFn(getLosVerdesMapData);
  const fetchMining = useServerFn(getLosVerdesMining);
  const fetchAnomalies = useServerFn(getLosVerdesAnomalies);
  const query = useQuery({ queryKey: ["losverdes-map-data"], queryFn: () => fetchData() });
  // Optional enrichments: veins and lineaments; failures fall back to map data.
  const mining = useQuery({ queryKey: ["losverdes-mining"], queryFn: () => fetchMining() });
  const anomalies = useQuery({
    queryKey: ["losverdes-anomalies"],
    queryFn: () => fetchAnomalies(),
  });
  const input = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const id = LOSVERDES_PROJECT_ID;
    const manifest = buildPublicGeoManifest(
      { id, name: "Los Verdes", center_lat: data.center[1], center_lng: data.center[0] },
      [
        "territory.cadastre",
        "remote_sensing.sentinel2_alteration",
        "remote_sensing.lineaments",
        "geology.interpreted_structures",
        "geophysics.anomalies",
        "sampling.results",
        "targets.exploration",
        "drilling.proposed",
      ],
    );
    const bundle = buildLosVerdesPublicGeoBundle(manifest, data, mining.data, anomalies.data);
    const layers: GeoSceneProjectLayer[] = bundleSceneLayers(bundle).map((layer) =>
      LOSVERDES_DEFAULT_HIDDEN.has(layer.id) ? { ...layer, defaultVisible: false } : layer,
    );
    if (emit.length)
      layers.push({
        id: "remote_sensing.hyperspectral",
        defaultVisible: false,
        source: "NASA EMIT L2B · GLT oficial; estimación espectral MODELADA, no ensaye ni recurso",
        data: {
          type: "FeatureCollection",
          features: emit.flatMap((layer) =>
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
      });
    return { project: { id, name: "Los Verdes", center: data.center, bbox: data.bbox }, layers };
  }, [query.data, mining.data, anomalies.data, emit]);
  if (query.isError)
    return (
      <p role="alert" className="p-6 text-content-subtle">
        No fue posible cargar las capas de Los Verdes.
      </p>
    );
  return (
    <ProjectSceneFrame
      project={input?.project ?? LOSVERDES_FALLBACK_PROJECT}
      layers={input?.layers ?? []}
      view={view}
      onViewChange={onViewChange}
    />
  );
}

function PalmerasScene({
  view,
  onViewChange,
}: {
  view: ProjectView;
  onViewChange?: (view: ProjectView) => void;
}) {
  const { concessions, anomalies, drillGrid, tenureNotice, projectId } = usePalmerasLayers();
  const layers = useMemo<GeoSceneProjectLayer[]>(
    () => [
      {
        id: "territory.cadastre",
        data: concessions,
        source: "SERNAGEOMIN · catastro local; asociación a cartera sujeta a verificación",
      },
      { id: "remote_sensing.sentinel2_alteration", data: anomalies as FeatureCollection },
      { id: "drilling.proposed", data: drillGrid as FeatureCollection },
    ],
    [concessions, anomalies, drillGrid],
  );
  return (
    <>
      {tenureNotice && <p className="mb-3 text-xs text-content-subtle">{tenureNotice}</p>}
      <ProjectSceneFrame
        project={{ id: projectId, name: "Las Palmeras", center: [-71.115471, -33.898438] }}
        layers={layers}
        view={view}
        onViewChange={onViewChange}
      />
    </>
  );
}
