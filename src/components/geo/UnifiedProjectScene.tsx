import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FeatureCollection } from "geojson";
import { GeoScene3D } from "@/components/geoscene/GeoScene3D";
import { bundleSceneLayers } from "@/components/geoscene/bundleAdapter";
import type { GeoSceneProject, GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import type { ProjectView } from "@/lib/projects/navigation";
import type { CanonicalProjectSlug } from "@/lib/projects/catalog";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { usePalmerasLayers } from "@/features/palmeras/usePalmerasLayers";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";

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
}: {
  project: GeoSceneProject;
  layers: GeoSceneProjectLayer[];
  view: ProjectView;
}) {
  return (
    <div data-surface="canvas" className="relative h-[620px] w-full overflow-hidden">
      <GeoScene3D
        key={project.id}
        project={project}
        projectLayers={layers}
        view={view}
        showModeTabs={false}
        showCopilot={false}
      />
    </div>
  );
}

/** Both public terminals and workspaces share these adapters and one renderer. */
export function UnifiedProjectScene({
  slug,
  view,
}: {
  slug: CanonicalProjectSlug;
  view: ProjectView;
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
        <CholquiScene view={view} />
      ) : slug === "losverdes" ? (
        <LosVerdesScene view={view} />
      ) : slug === "nahuelbuta" ? (
        <NahuelbutaScene view={view} />
      ) : (
        <PalmerasScene view={view} />
      )}
    </Suspense>
  );
}

function LosVerdesScene({ view }: { view: ProjectView }) {
  const emit = useEmitMineralogyLayers("losverdes");
  const fetchData = useServerFn(getLosVerdesMapData);
  const query = useQuery({ queryKey: ["losverdes-map-data"], queryFn: () => fetchData() });
  const input = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const id = "7a499b02-ecdf-447b-8956-b106fe4ec087";
    const manifest = buildPublicGeoManifest(
      { id, name: "Los Verdes", center_lat: data.center[1], center_lng: data.center[0] },
      [
        "territory.cadastre",
        "remote_sensing.sentinel2_alteration",
        "geophysics.anomalies",
        "sampling.results",
        "targets.exploration",
      ],
    );
    const bundle = buildLosVerdesPublicGeoBundle(manifest, data);
    const layers: GeoSceneProjectLayer[] = bundleSceneLayers(bundle);
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
  }, [query.data, emit]);
  if (query.isError)
    return (
      <p role="alert" className="p-6 text-content-subtle">
        No fue posible cargar las capas de Los Verdes.
      </p>
    );
  if (!input)
    return (
      <div className="h-[620px] grid place-items-center text-content-subtle">
        Cargando capas de Los Verdes…
      </div>
    );
  return <ProjectSceneFrame {...input} view={view} />;
}

function PalmerasScene({ view }: { view: ProjectView }) {
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
      />
    </>
  );
}
