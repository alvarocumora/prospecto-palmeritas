import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FeatureCollection } from "geojson";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";

/** Relieve 3D estándar de Los Verdes: mismo visor institucional que el resto de proyectos. */
export function LosVerdes3D() {
  const fetchData = useServerFn(getLosVerdesMapData);
  const query = useQuery({ queryKey: ["losverdes-map-data"], queryFn: () => fetchData() });

  const layers = useMemo(() => {
    const d = query.data;
    if (!d) return null;
    const concessions: FeatureCollection = {
      type: "FeatureCollection",
      features: d.concessions.features
        .filter((f) => f.geometry)
        .map((f) => ({ ...f, properties: { ...(f.properties ?? {}), es_tenencia_proyecto: true } })),
    } as FeatureCollection;
    const anomalies = {
      type: "FeatureCollection",
      features: [...d.satAnomalies.features, ...d.magAnomalies.features, ...d.targets.features],
    } as FeatureCollection;
    return { center: { lat: d.center[1], lng: d.center[0] }, concessions, anomalies, samples: d.samples as FeatureCollection };
  }, [query.data]);

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        No fue posible cargar las capas de Los Verdes.
      </div>
    );
  }
  if (!layers) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        Cargando relieve y capas…
      </div>
    );
  }
  return (
    <ProjectTerrain3D
      slug="losverdes"
      center={layers.center}
      extentMeters={12000}
      concessions={layers.concessions}
      anomalies={layers.anomalies}
    />
  );
}
