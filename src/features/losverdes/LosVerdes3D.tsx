import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";

/** Relieve 3D estándar de Los Verdes: mismo visor institucional que el resto de proyectos. */
export function LosVerdes3D({
  projectId = "7a499b02-ecdf-447b-8956-b106fe4ec087",
}: { projectId?: string } = {}) {
  const fetchData = useServerFn(getLosVerdesMapData);
  const query = useQuery({
    queryKey: ["losverdes-map-data"],
    queryFn: () => fetchData(),
    enabled: projectId === "7a499b02-ecdf-447b-8956-b106fe4ec087",
  });

  const layers = useMemo(() => {
    const d = query.data;
    if (!d) return null;
    const manifest = buildPublicGeoManifest(
      { id: projectId, name: "Los Verdes", center_lat: d.center[1], center_lng: d.center[0] },
      [
        "territory.cadastre",
        "remote_sensing.sentinel2_alteration",
        "geophysics.anomalies",
        "sampling.results",
        "targets.exploration",
      ],
    );
    return {
      center: { lat: d.center[1], lng: d.center[0] },
      evidenceBundle: buildLosVerdesPublicGeoBundle(manifest, d),
    };
  }, [query.data, projectId]);

  if (projectId !== "7a499b02-ecdf-447b-8956-b106fe4ec087")
    return (
      <p className="text-content-subtle">No hay capas de Los Verdes asociadas a este proyecto.</p>
    );
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
      projectId={projectId}
      notice={`${query.data?.tenure?.ownCount ?? 0} concesiones en cartera integrada · ${query.data?.tenure?.ownHa.toLocaleString("es-CL") ?? 0} ha mapeadas; asociación declarada y multi-titular, sujeta a verificación contractual. Objetivo distrital: ${query.data?.tenure?.targetHa.toLocaleString("es-CL") ?? 0} ha, saldo por confirmar.`}
      center={layers.center}
      extentMeters={12000}
      evidenceBundle={layers.evidenceBundle}
    />
  );
}
