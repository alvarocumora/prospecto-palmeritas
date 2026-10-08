import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import catastroRaw from "@/data/geo/palmeras_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/palmeras_satellite_anomalies.geojson?raw";
import drillRaw from "@/data/geo/palmeras_drill_grid.geojson?raw";

function parse(raw: string): FeatureCollection | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const concessions = parse(catastroRaw);
const anomalies = parse(anomaliesRaw);
const drillGrid = parse(drillRaw);

/** Visor maestro de Las Palmeras: catastro oficial SERNAGEOMIN + anomalías + malla de sondajes. */
export function PalmerasMasterViewer() {
  return (
    <ProjectMasterViewer
      projectName="Prospecto Las Palmeras"
      reportMapId="palmeras"
      center={{ lat: -33.898438, lng: -71.115471 }}
      concessions={concessions}
      anomalies={anomalies}
      drillGrid={drillGrid}
    />
  );
}
