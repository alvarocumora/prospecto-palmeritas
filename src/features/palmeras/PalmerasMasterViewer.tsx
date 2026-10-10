import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import { usePalmerasLayers } from "./usePalmerasLayers";

export function PalmerasMasterViewer() {
  const { concessions, anomalies, drillGrid, tenureNotice } = usePalmerasLayers();
  return (
    <ProjectMasterViewer
      projectName="Prospecto Las Palmeras"
      reportMapId="palmeras"
      coordinateNotice={tenureNotice}
      center={{ lat: -33.898438, lng: -71.115471 }}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
    />
  );
}
