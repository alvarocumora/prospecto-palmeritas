import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicCanonicalMap } from "@/components/geo/PublicCanonicalMap";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { buildLosVerdesPublicGeoBundle } from "@/lib/geospatial/losVerdesPublicGeoAdapter";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";
import { useEmitMineralogyLayers } from "@/lib/cholqui/emitMineralogy";

const PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export function LosVerdesMasterViewer() {
  const fetchData = useServerFn(getLosVerdesMapData);
  const emitLayers = useEmitMineralogyLayers("losverdes");
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
      <PublicCanonicalMap bundle={bundle} extraLayers={emitLayers} />
      {query.data?.tenure && (
        <section className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-4">
          {[
            [
              "Tenencia del proyecto",
              `${query.data.tenure.ownHa.toLocaleString("es-CL")} ha`,
              `${query.data.tenure.ownCount} concesiones · declarado SERNAGEOMIN`,
            ],
            [
              "Objetivo integrado",
              `~${query.data.tenure.targetHa.toLocaleString("es-CL")} ha`,
              `~${(query.data.tenure.targetHa - query.data.tenure.ownHa).toLocaleString("es-CL")} ha por confirmar`,
            ],
            [
              "Vecinos mayores",
              `${query.data.tenure.neighborHa.toLocaleString("es-CL")} ha`,
              `${query.data.tenure.neighborCount} concesiones · no son del proyecto`,
            ],
            [
              "Recursos / reservas",
              "No declarados",
              `${query.data.counts.samples} muestras medidas · ${query.data.counts.targets} targets (interpretación)`,
            ],
          ].map(([k, v, d]) => (
            <div key={k} className="bg-surface p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                {k}
              </p>
              <p className="mt-1 font-serif text-2xl text-content">{v}</p>
              <p className="mt-1 text-xs text-content-subtle">{d}</p>
            </div>
          ))}
        </section>
      )}
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
