import type { FeatureCollection } from "geojson";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import catastroRaw from "@/data/geo/palmeras_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/palmeras_satellite_anomalies.geojson?raw";
import drillRaw from "@/data/geo/palmeras_drill_grid.geojson?raw";

const parse = (raw: string): FeatureCollection | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function Palmeras3D() {
  return (
    <ProjectTerrain3D
      slug="palmeras"
      center={{ lat: -33.898438, lng: -71.115471 }}
      extentMeters={8000}
      concessions={parse(catastroRaw)}
      anomalies={parse(anomaliesRaw)}
      drillGrid={parse(drillRaw)}
    />
  );
}
