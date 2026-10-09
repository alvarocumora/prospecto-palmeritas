import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import type { PublicSatProject } from "@/lib/publicSatellite.functions";
import type { SatelliteSelection } from "@/lib/projects/navigation";

export function SatelliteProjectScene({
  project,
  selection,
}: {
  project: PublicSatProject;
  selection: SatelliteSelection;
}) {
  const selectedAnomaly = project.anomalies.find((item) => item.id === selection.anomaly);
  const selectedInsar = project.insar.find((item) => item.id === selection.insar);
  const center =
    selectedAnomaly?.lat != null && selectedAnomaly.lng != null
      ? { lat: selectedAnomaly.lat, lng: selectedAnomaly.lng }
      : project.center_lat != null && project.center_lng != null
        ? { lat: project.center_lat, lng: project.center_lng }
        : null;
  const anomalies = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: project.anomalies.flatMap((item) =>
        item.lat == null || item.lng == null
          ? []
          : [
              {
                type: "Feature" as const,
                id: item.id,
                geometry: { type: "Point" as const, coordinates: [item.lng, item.lat] },
                properties: {
                  id: item.id,
                  name: item.index_code ?? item.id,
                  score: item.score,
                  severity: item.severity,
                },
              },
            ],
      ),
    }),
    [project.anomalies],
  );

  return (
    <div className="mt-6 space-y-4" data-satellite-project={project.id}>
      {(selection.anomaly || selection.insar) && (
        <section className="rounded border border-hairline p-4 text-sm">
          {selectedAnomaly && (
            <p>
              Anomalía seleccionada: {selectedAnomaly.index_code ?? selectedAnomaly.id}
              {" · "}
              {selectedAnomaly.severity ?? "Sin severidad"}
              {" · "}Puntaje {selectedAnomaly.score ?? "—"}
            </p>
          )}
          {selectedInsar && (
            <p>
              InSAR seleccionado: {selectedInsar.asset_name ?? selectedInsar.id}
              {" · "}
              {selectedInsar.velocity_mm_year ?? "—"} mm/año
            </p>
          )}
          {selection.anomaly && !selectedAnomaly && (
            <p>La anomalía solicitada no está disponible en este proyecto.</p>
          )}
          {selection.insar && !selectedInsar && (
            <p>La adquisición InSAR solicitada no está disponible en este proyecto.</p>
          )}
        </section>
      )}
      {center ? (
        <ProjectTerrain3D
          key={`${project.id}:${selection.anomaly ?? ""}`}
          projectId={project.id}
          slug={project.id}
          center={center}
          anomalies={anomalies}
          selectedFeatureId={selection.anomaly}
          extentMeters={12000}
        />
      ) : (
        <p className="text-sm text-content-subtle">
          No hay coordenadas publicadas para mostrar el relieve de este proyecto.
        </p>
      )}
    </div>
  );
}
