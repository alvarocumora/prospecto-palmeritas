import { useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ProjectMasterViewer, type AssayPoint } from "@/components/geo/ProjectMasterViewer";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";

/** Visor maestro de Los Verdes: concesiones, anomalías satelitales y muestras desde la base del proyecto. */
export function LosVerdesMasterViewer() {
  const fetchData = useServerFn(getLosVerdesMapData);
  const q = useQuery({ queryKey: ["losverdes-map-data"], queryFn: () => fetchData() });

  const layers = useMemo(() => {
    const d = q.data;
    if (!d) return null;
    const concessions = {
      type: "FeatureCollection",
      features: d.concessions.features
        .filter((f) => f.geometry)
        .map((f) => ({ ...f, properties: { ...f.properties, es_tenencia_proyecto: true } })),
    } as unknown as FeatureCollection;
    const anomalies = d.satAnomalies as unknown as FeatureCollection;
    const assays: AssayPoint[] = d.samples.features.flatMap((f) => {
      if (f.geometry?.type !== "Point") return [];
      const [lng, lat] = f.geometry.coordinates as number[];
      const p = f.properties;
      return [
        {
          code: String(p.sample_code ?? p.id ?? ""),
          lat,
          lng,
          cuTotalPct: p.cu_pct == null ? undefined : Number(p.cu_pct),
          auGpt: p.au_gpt == null ? undefined : Number(p.au_gpt),
          agPpm: p.ag_gpt == null ? undefined : Number(p.ag_gpt),
        },
      ];
    });
    return { concessions, anomalies, assays, center: { lng: d.center[0], lat: d.center[1] } };
  }, [q.data]);

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        No fue posible cargar las capas de Los Verdes. Intenta recargar la página.
      </div>
    );
  }
  if (!layers) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        Cargando concesiones y anomalías…
      </div>
    );
  }
  return (
    <ProjectMasterViewer
      projectName="Los Verdes"
      reportMapId="losverdes"
      center={layers.center}
      concessions={layers.concessions}
      anomalies={layers.anomalies}
      assays={layers.assays}
    />
  );
}
