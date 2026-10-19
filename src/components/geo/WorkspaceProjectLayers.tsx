import type { Map as LeafletMap } from "leaflet";
import { useMemo } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Project } from "@/hooks/useProjects";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { useProjectGeophysicsData } from "@/hooks/useProjectGeophysicsData";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { getPublicProjectById } from "@/lib/projects/catalog";
import { UnifiedProjectScene, ProjectSceneFrame } from "./UnifiedProjectScene";
import { bundleSceneLayers } from "@/components/geoscene/bundleAdapter";
import { resolveProjectTenure } from "@/lib/geospatial/projectTenure";
import { buildPublicGeoManifest, type PublicGeoBundle } from "@/lib/geospatial/publicGeoContract";
import { ProjectMasterViewer } from "./ProjectMasterViewer";

import type { ProjectView } from "@/lib/projects/navigation";

export function WorkspaceProjectLayers({ project, view }: { project: Project; view: ProjectView }) {
  const slug = getPublicProjectById(project.id)?.slug;
  return slug ? (
    <UnifiedProjectScene slug={slug} view={view} />
  ) : (
    <PortfolioLayers project={project} view={view} unified />
  );
}

export function PortfolioLayers({
  project,
  view,
  onMapReady,
  basemapOverride,
  unified = false,
}: {
  project: Project;
  view: ProjectView;
  onMapReady?: (map: LeafletMap) => void;
  basemapOverride?: "satellite" | "topo" | null;
  unified?: boolean;
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
  if (unified || view === "3d")
    return (
      <ProjectSceneFrame
        project={{ id: project.id, name: project.name, center: evidenceBundle.center }}
        layers={bundleSceneLayers(evidenceBundle)}
        view={view}
      />
    );
  return (
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
  );
}
