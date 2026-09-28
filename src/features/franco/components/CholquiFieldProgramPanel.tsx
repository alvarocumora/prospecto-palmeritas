/**
 * Minuta de acciones en terreno (Fase 0) del Proyecto Cholqui.
 *
 * Convierte los targets derivados del satélite en un programa de trabajo
 * defendible: mapeo estructural, canaleta con QA/QC y geofísica de detalle.
 * No presenta leyes, recursos ni cifras financieras.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Loader2 } from "lucide-react";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { getCholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { buildFieldProgram } from "@/lib/cholqui/fieldProgram";
import { buildCholquiFieldMemoDoc } from "@/lib/pdf/adapters/cholquiFieldMemo";
import { tenureAt } from "@/lib/pdf/adapters/cholquiTargets";

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const PRIORITY_STYLE: Record<string, string> = {
  Alta: "bg-accent-brand text-white",
  Media: "bg-accent-brand-subtle text-accent-brand",
  Baja: "bg-surface-2 text-content-subtle",
};

export function CholquiFieldProgramPanel() {
  const fn = useServerFn(getCholquiSatelliteTargets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["cholqui-satellite-targets"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  const program = useMemo(() => (data ? buildFieldProgram(data) : null), [data]);

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" />
            Minuta de terreno · fase 0
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            Programa de validación antes de perforar
          </h2>
          <p className="text-sm text-content-subtle mt-1 max-w-3xl">
            Qué hay que hacer en terreno para convertir un indicio satelital en evidencia medida:
            mapeo estructural, canaleta con control de calidad y geofísica de detalle. Cada cantidad
            se deriva de la geometría de los targets, no de supuestos comerciales.
          </p>
        </div>
        <ProjectDocsMenu
          className="h-10 shrink-0"
          variant="outline"
          label="Descargar minuta de terreno"
          disabled={!data}
          build={() => (data ? buildCholquiFieldMemoDoc(data, program ?? undefined) : null)}
        />
      </header>

      {isLoading && (
        <div className="px-6 py-10 flex items-center gap-2 text-sm text-content-subtle">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando el programa de terreno…
        </div>
      )}

      {error && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          No se pudo leer la corrida satelital: no se genera un programa sin datos reales.
        </div>
      )}

      {program && program.targets.length === 0 && !isLoading && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          No hay targets dentro de la tenencia conocida: no se programa trabajo de terreno hasta
          verificar la tenencia de las anomalías restantes.
        </div>
      )}

      {program && program.targets.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
            {[
              ["Targets a validar", String(program.targets.length)],
              [
                "Superficie a mapear",
                `${num(program.mapping.areaHa)} ha · ${program.mapping.scale}`,
              ],
              [
                "Muestras a laboratorio",
                `${num(program.channel.submittedTotal)} (${num(program.channel.controlTotal)} de control)`,
              ],
              ["Duración", `${program.totals.days} jornadas · ~${program.totals.weeks} semanas`],
            ].map(([k, v]) => (
              <div key={k} className="px-5 py-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  {k}
                </div>
                <div className="mt-1 text-sm font-medium text-content">{v}</div>
              </div>
            ))}
          </div>

          {/* Targets */}
          <div className="px-6 py-6 border-b border-hairline">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
              Targets · concesión de catastro, titularidad y trabajo asignado
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-content-subtle border-b border-hairline">
                    <th className="py-2 pr-3 font-mono font-normal">Target</th>
                    <th className="py-2 pr-3 font-mono font-normal">Concesión (catastro)</th>
                    <th className="py-2 pr-3 font-mono font-normal">Titularidad</th>
                    <th className="py-2 pr-3 font-mono font-normal">Firma espectral</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Puntaje</th>
                    <th className="py-2 pr-3 font-mono font-normal">Prioridad</th>
                    <th className="py-2 font-mono font-normal text-right">Canaletas</th>
                  </tr>
                </thead>
                <tbody>
                  {program.targets.map((t) => {
                    const tenure = tenureAt(t.lat, t.lng);
                    return (
                      <tr key={t.label} className="border-b border-hairline/60">
                        <td className="py-2 pr-3 font-mono text-content">{t.label}</td>
                        <td className="py-2 pr-3 text-content-subtle">
                          {tenure.concession ?? "Sin concesión en el catastro cargado"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                              tenure.own
                                ? "bg-accent-brand/10 text-accent-brand"
                                : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {tenure.own ? "Tenencia analizada" : "Tercero"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-content">{t.indexName}</td>
                        <td className="py-2 pr-3 text-right font-mono text-content">
                          {t.score != null ? t.score.toFixed(2).replace(".", ",") : "s/d"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                              PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.Baja
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-content">{t.channelSites}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-content-subtle">
              La titularidad se resuelve contra el catastro SERNAGEOMIN cargado. Los targets
              marcados como &ldquo;Tercero&rdquo; caen en concesiones inscritas a nombre de otro
              titular: no se ejecuta trabajo sobre ellos sin verificación registral y acuerdo
              escrito.
            </p>
          </div>

          {/* Actividades */}
          <div className="px-6 py-6 border-b border-hairline">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
              Actividades, método y entregable
            </div>
            <ol className="space-y-3">
              {program.tasks.map((t) => (
                <li
                  key={t.id}
                  className="grid md:grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1 border-b border-hairline/60 pb-3 last:border-0"
                >
                  <span className="font-mono text-[11px] text-accent-brand pt-0.5">{t.id}</span>
                  <div>
                    <div className="text-sm font-medium text-content">{t.title}</div>
                    <div className="text-xs text-content-subtle mt-0.5">{t.objective}</div>
                    <div className="text-[11px] text-content-subtle mt-1">
                      <b className="font-medium text-content">Método:</b> {t.method}
                    </div>
                    <div className="text-[11px] text-content-subtle">
                      <b className="font-medium text-content">Entregable:</b> {t.deliverable}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-content-subtle whitespace-nowrap pt-0.5">
                    {t.days} j
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* QA/QC + geofísica */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-hairline border-b border-hairline">
            <div className="px-6 py-6">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                Muestreo y control de calidad
              </div>
              <dl className="space-y-1.5 text-xs">
                {[
                  ["Sitios de canaleta", String(program.channel.sites)],
                  [
                    "Tramo de muestra",
                    `${String(program.channel.sampleLengthM).replace(".", ",")} m continuos`,
                  ],
                  ["Muestras primarias", num(program.channel.samples)],
                  ["Blancos analíticos", `${program.channel.blanks} (5 %)`],
                  ["Duplicados de campo", `${program.channel.duplicates} (5 %)`],
                  ["Estándares certificados", `${program.channel.crm} (5 %)`],
                  ["Total a laboratorio", num(program.channel.submittedTotal)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-content-subtle">{k}</dt>
                    <dd className="font-mono text-content">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="px-6 py-6">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                Geofísica de detalle
              </div>
              <dl className="space-y-1.5 text-xs">
                {[
                  [
                    "Magnetometría terrestre",
                    `${num(program.geophysics.magLineKm, 1)} km de línea`,
                  ],
                  ["Separación de líneas", `${program.geophysics.magSpacingM} m`],
                  [
                    "Polarización inducida",
                    `${program.geophysics.ipLines} líneas · ${num(program.geophysics.ipLineKm, 1)} km`,
                  ],
                  ["Arreglo IP", program.geophysics.ipArray],
                  ["Orientación", "Transversal al rumbo N20E"],
                  ["Producto", "Inversión 2D de cargabilidad y resistividad"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-content-subtle">{k}</dt>
                    <dd className="font-mono text-content text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Permisos */}
          <div className="px-6 py-6">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
              Habilitación, permisos y responsables
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {program.permits.map((x) => (
                    <tr key={x.item} className="border-b border-hairline/60">
                      <td className="py-2 pr-3 text-content">{x.item}</td>
                      <td className="py-2 pr-3 text-content-subtle">{x.responsible}</td>
                      <td className="py-2 text-content-subtle">{x.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[11px] text-content-subtle">
              Programa de planificación de exploración. Los resultados de esta fase no constituyen
              recursos ni reservas bajo CH 20235 / NI 43-101 / JORC, y su ejecución está sujeta a
              tenencia vigente, servidumbres, permisos sectoriales y laboratorio acreditado.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
