import type { Map as LeafletMap } from "leaflet";
import { lazy, Suspense, useMemo } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Project } from "@/hooks/useProjects";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { useProjectGeophysicsData } from "@/hooks/useProjectGeophysicsData";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { resolveProjectViewerProfile } from "@/lib/geospatial/projectViewerProfiles";
import { resolveProjectTenure } from "@/lib/geospatial/projectTenure";
import { buildPublicGeoManifest, type PublicGeoBundle } from "@/lib/geospatial/publicGeoContract";
import { ProjectMasterViewer } from "./ProjectMasterViewer";
import { ProjectTerrain3D } from "./ProjectTerrain3D";
import type { ProjectView } from "@/lib/projects/navigation";

const Cholqui2D = lazy(() =>
  import("@/features/franco/components/CholquiMasterViewer").then((m) => ({
    default: m.CholquiMasterViewer,
  })),
);
const Cholqui3D = lazy(() =>
  import("@/features/franco/components/CholquiTerrain3D").then((m) => ({
    default: m.CholquiTerrain3D,
  })),
);
const Palmeras2D = lazy(() =>
  import("@/features/palmeras/PalmerasMasterViewer").then((m) => ({
    default: m.PalmerasMasterViewer,
  })),
);
const Palmeras3D = lazy(() =>
  import("@/features/palmeras/Palmeras3D").then((m) => ({ default: m.Palmeras3D })),
);
const LosVerdes2D = lazy(() =>
  import("@/features/losverdes/LosVerdesMasterViewer").then((m) => ({
    default: m.LosVerdesMasterViewer,
  })),
);
const LosVerdes3D = lazy(() =>
  import("@/features/losverdes/LosVerdes3D").then((m) => ({ default: m.LosVerdes3D })),
);

export function WorkspaceProjectLayers({ project, view }: { project: Project; view: ProjectView }) {
  const profile = resolveProjectViewerProfile(project)?.key;
  const Component =
    profile === "cholqui" && project.id === "e5360f13-1647-4e44-bb13-c0614e6f39fe"
      ? view === "2d"
        ? Cholqui2D
        : Cholqui3D
      : profile === "palmeras" && project.id === "8dc8e288-b22c-4bd4-9626-bb7fb85d1745"
        ? view === "2d"
          ? Palmeras2D
          : Palmeras3D
        : profile === "losverdes" && project.id === "7a499b02-ecdf-447b-8956-b106fe4ec087"
          ? view === "2d"
            ? LosVerdes2D
            : LosVerdes3D
          : null;
  return (
    <Suspense fallback={<p className="p-4 text-content-subtle">Cargando visor compartido…</p>}>
      {Component ? <Component /> : <PortfolioLayers project={project} view={view} />}
    </Suspense>
  );
}

export function PortfolioLayers({
  project,
  view,
  onMapReady,
  basemapOverride,
}: {
  project: Project;
  view: ProjectView;
  onMapReady?: (map: LeafletMap) => void;
  basemapOverride?: "satellite" | "topo" | null;
}) {
  const portfolio = useMiningConcessions(project.id);
  const geophysics = useProjectGeophysicsData(project.id);
  const { targets } = useExplorationTargets(project.id);
  const concessions = useMemo(
    () =>
      resolveProjectTenure(
        {
          type: "FeatureCollection",
          features: portfolio.data.flatMap((row): Feature[] => {
            let geometry: Geometry | null = null;
            try {
              geometry =
                typeof row.geometry_geojson === "string"
                  ? JSON.parse(row.geometry_geojson)
                  : (row.geometry_geojson as Geometry | null);
            } catch {
              /* Missing geometry stays missing. */
            }
            if (!geometry) return [];
            return [
              {
                type: "Feature",
                id: row.id,
                geometry,
                properties: {
                  ...row,
                  nombre: row.name,
                  titular: row.holder,
                  rol: row.code,
                  situacion: row.status,
                  hectareas: row.area_ha,
                  tipo: row.concession_type,
                },
              },
            ];
          }),
        },
        { projectId: project.id },
      ),
    [portfolio.data, project.id],
  );
  const targetFeatures = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: targets.flatMap((target) =>
        target.lng == null || target.lat == null
          ? []
          : [
              {
                type: "Feature",
                id: target.id,
                geometry: { type: "Point", coordinates: [target.lng, target.lat] },
                properties: { ...target, procedencia: "declared" },
              },
            ],
      ),
    }),
    [targets],
  );
  const evidenceBundle = useMemo<PublicGeoBundle>(
    () => ({
      manifest: buildPublicGeoManifest(
        {
          id: project.id,
          name: project.name,
          center_lat: project.center_lat,
          center_lng: project.center_lng,
        },
        ["territory.cadastre", "targets.exploration"],
      ),
      center: [project.center_lng ?? 0, project.center_lat ?? 0],
      bbox: null,
      layers: {
        "territory.cadastre": {
          type: "FeatureCollection",
          features: concessions.features.map((f) => ({ ...f, properties: f.properties ?? {} })),
        },
        "targets.exploration": {
          type: "FeatureCollection",
          features: targetFeatures.features.map((f) => ({ ...f, properties: f.properties ?? {} })),
        },
      },
    }),
    [project, concessions, targetFeatures],
  );
  if (project.center_lat == null || project.center_lng == null)
    return (
      <p className="p-4 text-content-subtle">
        Faltan coordenadas del proyecto para encuadrar sus capas.
      </p>
    );
  if (portfolio.error)
    return (
      <p className="p-4 text-content-subtle">No fue posible consultar la cartera de concesiones.</p>
    );
  const center = { lat: project.center_lat, lng: project.center_lng };
  return view === "2d" ? (
    <ProjectMasterViewer
      onMapReady={onMapReady}
      basemapOverride={basemapOverride}
      projectName={project.name}
      center={center}
      concessions={concessions}
      geophysics={geophysics.data}
      enableLayerTools
      contextLayers={[
        {
          id: "targets.exploration",
          label: "Targets",
          evidence: "DECLARADO",
          features: targetFeatures,
        },
      ]}
    />
  ) : (
    <ProjectTerrain3D
      evidenceBundle={evidenceBundle}
      slug={project.name}
      projectId={project.id}
      center={center}
      concessions={concessions}
    />
  );
}
