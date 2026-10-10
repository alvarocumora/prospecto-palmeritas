import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import { usePalmerasLayers } from "./usePalmerasLayers";

export function Palmeras3D() {
  const { projectId, concessions, anomalies, drillGrid, tenureNotice } = usePalmerasLayers();
  return (
    <ProjectTerrain3D
      slug="palmeras"
      projectId={projectId}
      notice={tenureNotice}
      center={{ lat: -33.898438, lng: -71.115471 }}
      extentMeters={8000}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
    />
  );
}
