import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicCanonicalMap } from "@/components/geo/PublicCanonicalMap";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export function LosVerdesMasterViewer() {
  const fetchData = useServerFn(getLosVerdesMapData);
  const query = useQuery({
    queryKey: ["losverdes-map-data"],
    queryFn: () => fetchData(),
  });
  const bundle = useMemo(() => {
    if (!query.data) return null;
    const manifest = buildPublicGeoManifest(
      {
        id: PROJECT_ID,
        name: "Los Verdes",
        center_lat: query.data.center[1],
        center_lng: query.data.center[0],
      },
      [
        "territory.cadastre",
        "remote_sensing.sentinel2_alteration",
        "geophysics.anomalies",
        "sampling.results",
        "targets.exploration",
      ],
    );
    return buildLosVerdesPublicGeoBundle(manifest, query.data);
  }, [query.data]);

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        No fue posible cargar las capas de Los Verdes. Intenta recargar la página.
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="rounded-2xl border border-hairline p-6 text-sm text-content-subtle">
        Cargando concesiones, targets, magnetometría y muestras…
      </div>
    );
  }
  return (
    <div data-report-map="losverdes" className="space-y-3">
      <PublicCanonicalMap bundle={bundle} />
      <aside className="rounded-2xl border border-hairline bg-surface p-4 text-xs leading-relaxed text-content-subtle">
        <p className="mb-2 font-mono uppercase tracking-wider text-content">
          Tilama GeoAI · control de calidad · {query.data?.counts.targets ?? 0} targets ·{" "}
          {query.data?.counts.samples ?? 0} muestras (WGS84 / UTM 19S, EPSG:32719)
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>TOO-270</strong> (Cu 455.700 ppm) es un valor crítico pendiente de re-ensaye y
            revisión del tipo de muestra; no representa una ley.
          </li>
          <li>Fe % se conserva como dato crudo: escala no validada, no se interpreta.</li>
          <li>Au de esta campaña no se mezcla con resultados históricos sin conciliar métodos.</li>
          <li>
            Targets y anomalías Sentinel-2 son priorización de exploración (interpretación), no
            recursos ni reservas.
          </li>
        </ul>
      </aside>
    </div>
  );
}
