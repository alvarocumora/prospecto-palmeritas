/**
 * Resumen de targets satelitales y malla de sondajes propuesta (sin mapa).
 * El mapa vive en el visor maestro unificado; aquí sólo queda la tabla
 * técnica y la descarga del informe de targets.
 *
 * Anomalías = DERIVADO. Malla = PROPUESTA CONCEPTUAL. Nunca mineralización.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateCholquiTargetNotes } from "@/lib/cholqui/targetNotes.functions";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { getCholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { buildCholquiTargetsDoc, concessionAt } from "@/lib/pdf/adapters/cholquiTargets";
import type { AgentNote } from "@/lib/pdf/adapters/cholquiTargets";
import { indexLabel } from "@/lib/cholqui/drillGrid";

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CholquiTargetsSummary() {
  const fn = useServerFn(getCholquiSatelliteTargets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["cholqui-satellite-targets"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const notesFn = useServerFn(generateCholquiTargetNotes);
  const [notes, setNotes] = useState<AgentNote[]>([]);
  const [notesBusy, setNotesBusy] = useState(false);

  const runAgent = async () => {
    if (!data) return;
    setNotesBusy(true);
    try {
      const inTenure = data.anomalies.filter((a) => a.withinTenure);
      const targets = [
        ...inTenure.map((a) => ({
          label: a.id,
          kind: "anomalia" as const,
          concession: concessionAt(a.lat, a.lng),
          facts: `${indexLabel(a.indexCode)}; puntaje ${a.score ?? "s/d"}; z ${
            a.zScore ?? "s/d"
          }; area ${
            a.areaHa ?? "s/d"
          } ha; Sentinel-2 L2A, no verificada en terreno; rumbo estructural dominante N20E.`,
        })),
        ...data.collars.map((c) => ({
          label: c.code,
          kind: "collar" as const,
          concession: concessionAt(c.lat, c.lng),
          facts: `Collar propuesto conceptual; azimut ${c.azimuthDeg}; inclinacion ${c.dipDeg}; profundidad ${c.depthM} m; prioridad ${c.priority}; objetivo: ${c.objective}.`,
        })),
      ].slice(0, 20);
      const res = await notesFn({ data: { targets } });
      if (res.error || !res.notes.length) {
        toast.error(res.error ?? "El agente no devolvió notas");
      } else {
        setNotes(res.notes);
        toast.success(`${res.notes.length} notas generadas por el agente IA`);
      }
    } finally {
      setNotesBusy(false);
    }
  };

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5" />
            Targets y malla propuesta
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            Malla de sondajes propuesta · fase 1
          </h2>
          <p className="text-sm text-content-subtle mt-1 max-w-3xl">
            Propuesta publicada de siete collares, compartida con el mapa y el informe. Sus
            objetivos y vínculos de anomalía requieren revisión de terreno; el score satelital
            conserva su valor original y no compara campañas o índices distintos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            className="h-10"
            disabled={!data || notesBusy}
            onClick={runAgent}
          >
            {notesBusy ? <Loader2 className="animate-spin" /> : <Bot />}
            {notes.length ? "Regenerar notas IA" : "Notas del agente IA"}
          </Button>
          <ProjectDocsMenu
            className="h-10 shrink-0"
            variant="outline"
            label="Descargar informe de targets"
            disabled={!data}
            build={() => (data ? buildCholquiTargetsDoc(data, notes) : null)}
          />
        </div>
      </header>

      {notes.length > 0 && (
        <div className="px-6 py-5 border-b border-hairline bg-surface-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            Notas del agente geológico-geofísico · interpretación IA, no verificada
          </div>
          <ul className="grid md:grid-cols-2 gap-3">
            {notes.map((n) => (
              <li
                key={n.label}
                className="text-xs text-content border border-hairline rounded-lg p-3 bg-surface"
              >
                <b className="font-mono">{n.label}</b> — {n.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && (
        <div className="px-6 py-10 flex items-center gap-2 text-sm text-content-subtle">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando la corrida satelital…
        </div>
      )}

      {error && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          No se pudo leer la corrida satelital del proyecto. No se generan capas sintéticas.
        </div>
      )}

      {data && data.collars.length === 0 && !isLoading && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          El archivo publicado no contiene collares propuestos. La ausencia de una propuesta no
          implica ausencia de mineralización.
        </div>
      )}

      {data && data.collars.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
            {[
              ["Anomalías", `${data.summary.anomalies} · ${data.summary.withinTenure} en tenencia`],
              [
                "Superficie interpretable",
                data.coverage.typicalPct != null
                  ? `${num(data.coverage.typicalPct, 1)} % (mejor caso ${
                      data.coverage.bestCasePct != null ? num(data.coverage.bestCasePct, 1) : "s/d"
                    } %)`
                  : "s/d",
              ],
              ["Plataformas propuestas", String(data.summary.collars)],
              ["Metraje propuesto", `${num(data.summary.totalMeters)} m`],
            ].map(([k, v]) => (
              <div key={k} className="px-5 py-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  {k}
                </div>
                <div className="mt-1 text-sm font-medium text-content">{v}</div>
              </div>
            ))}
          </div>

          <div className="px-6 py-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-content-subtle border-b border-hairline">
                    <th className="py-2 pr-3 font-mono font-normal">Sondaje</th>
                    <th className="py-2 pr-3 font-mono font-normal">Collar (lat, lon)</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Azimut</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Incl.</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Prof.</th>
                    <th className="py-2 pr-3 font-mono font-normal">Prioridad</th>
                    <th className="py-2 font-mono font-normal">Objetivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collars.map((c) => (
                    <tr key={c.code} className="border-b border-hairline/60 align-top">
                      <td className="py-2 pr-3 font-mono text-content">{c.code}</td>
                      <td className="py-2 pr-3 font-mono text-content-subtle">
                        {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content">
                        {c.azimuthDeg}°
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content">{c.dipDeg}°</td>
                      <td className="py-2 pr-3 text-right font-mono text-content">
                        {num(c.depthM)} m
                      </td>
                      <td className="py-2 pr-3 text-content">{c.priority}</td>
                      <td className="py-2 text-content-subtle max-w-[320px]">{c.objective}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[11px] text-content-subtle">
              Coordenadas de collar preliminares: requieren topografía, acceso, servidumbres y
              permisos antes de ejecutarse. La detección satelital y la malla propuesta no
              constituyen recursos ni reservas bajo CH 20235 / NI 43-101 / JORC.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
