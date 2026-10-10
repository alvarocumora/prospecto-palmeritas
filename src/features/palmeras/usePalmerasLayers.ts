import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { resolveProjectTenure } from "@/lib/geospatial/projectTenure";
import catastroRaw from "@/data/geo/palmeras_catastro_sngm.geojson?raw";
import anomaliesRaw from "@/data/geo/palmeras_satellite_anomalies.geojson?raw";
import drillRaw from "@/data/geo/palmeras_drill_grid.geojson?raw";

const PROJECT_ID = "8dc8e288-b22c-4bd4-9626-bb7fb85d1745";
const catastro = JSON.parse(catastroRaw) as FeatureCollection;
const anomalies = JSON.parse(anomaliesRaw) as FeatureCollection;
const drillGrid = JSON.parse(drillRaw) as FeatureCollection;

/** RLS applies to the project portfolio. Nearby official polygons alone do not prove tenure. */
export function usePalmerasLayers() {
  const portfolio = useMiningConcessions(PROJECT_ID);
  const concessions = useMemo(
    () =>
      resolveProjectTenure(catastro, {
        projectId: PROJECT_ID,
        concessionCodes: portfolio.data.map((concession) => concession.code),
        holderRuts: portfolio.data.flatMap((concession) =>
          concession.rut_holder ? [concession.rut_holder] : [],
        ),
      }),
    [portfolio.data],
  );
  return {
    projectId: PROJECT_ID,
    concessions,
    anomalies,
    drillGrid,
    tenureNotice:
      portfolio.error || !portfolio.data.length
        ? "Tenencia pendiente de verificación: no hay una cartera accesible para asociar los roles del catastro."
        : !concessions.features.some((feature) => feature.properties?.es_tenencia_proyecto === true)
          ? "Tenencia pendiente de verificación: no hay coincidencias de rol o RUT entre la cartera accesible y el catastro local."
          : undefined,
  };
}
