// Pipeline interno de adquisición: proyectos en fase pedimento + pedimentos +
// ficha técnica + alertas. Lado de adquisición/opción — distinto del
// marketplace de venta en /dashboard/deals ("Deal Flow"). Se apoya en
// projects/pedimentos/project_facts/follow_up_tasks, no en `public.deals`
// (ver nota en acquisitionProjects.functions.ts sobre por qué esa tabla
// está deprecada y no corresponde acá).
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Compass, MapPin, ShieldAlert, FileText, Loader2 } from "lucide-react";
import {
  listAcquisitionProjects,
  getAcquisitionProjectDetail,
  type AcquisitionFact,
  type AcquisitionProjectDetail,
} from "@/lib/acquisitionProjects.functions";
import {
  FACT_SECTION_LABELS,
  PROVENANCE_LABELS,
  PROVENANCE_TONE,
  type FactSection,
} from "@/lib/provenance";

export const Route = createFileRoute("/_authenticated/dashboard/acquisitions")({
  head: () => ({ meta: [{ title: "Pipeline de Adquisición — Geocapitals" }] }),
  component: AcquisitionsPage,
});

const PRIORITY_TONE: Record<string, string> = {
  critical: "text-red-700 bg-red-500/10 border-red-500/30",
  high: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  medium: "text-sky-700 bg-sky-500/10 border-sky-500/30",
  low: "text-muted-foreground bg-muted border-border",
};

function groupBySection(facts: AcquisitionFact[]): Array<[FactSection, AcquisitionFact[]]> {
  const map = new Map<FactSection, AcquisitionFact[]>();
  for (const f of facts) {
    if (!map.has(f.section)) map.set(f.section, []);
    map.get(f.section)!.push(f);
  }
  return Array.from(map.entries());
}

function AcquisitionsPage() {
  const list = useServerFn(listAcquisitionProjects);
  const detail = useServerFn(getAcquisitionProjectDetail);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projects = useQuery({ queryKey: ["acquisition-projects"], queryFn: () => list() });

  const firstId = projects.data?.projects[0]?.id ?? null;
  const activeId = selectedId ?? firstId;

  const projectDetail = useQuery({
    queryKey: ["acquisition-project", activeId],
    queryFn: () => detail({ data: { projectId: activeId as string } }),
    enabled: !!activeId,
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Compass className="h-7 w-7 text-gold" />
          Pipeline de Adquisición
        </h1>
        <p className="text-muted-foreground mt-1">
          Proyectos en fase pedimento/pre-exploración que estamos evaluando adquirir — ficha
          técnica, pedimentos y alertas en un solo lugar.
        </p>
      </header>

      {projects.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando proyectos…
        </div>
      )}
      {projects.data?.pending && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          El pipeline de adquisición todavía no está migrado en esta base.
        </div>
      )}
      {projects.data && !projects.data.pending && projects.data.projects.length === 0 && (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No hay proyectos en fase de adquisición cargados todavía.
        </div>
      )}

      {projects.data && projects.data.projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-6">
          <div className="space-y-2">
            {projects.data.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  p.id === activeId ? "border-gold bg-gold/5" : "border-border hover:border-gold/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                  {p.openAlerts > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <ShieldAlert className="h-3 w-3" /> {p.openAlerts}
                    </span>
                  )}
                </div>
                <div className="font-semibold mt-0.5">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                  {p.commodity && <span>{p.commodity}</span>}
                  {p.region && <span>· {p.region}</span>}
                  <span>· {p.status}</span>
                </div>
              </button>
            ))}
          </div>

          <div>
            {projectDetail.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…
              </div>
            )}
            {projectDetail.data && <ProjectDetailPanel detail={projectDetail.data} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetailPanel({ detail: d }: { detail: AcquisitionProjectDetail }) {
  const sections = groupBySection(d.facts);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-semibold">{d.project.name}</h2>
          <span className="font-mono text-xs text-muted-foreground">{d.project.code}</span>
        </div>
        {d.project.description && (
          <p className="text-sm text-muted-foreground mt-2">{d.project.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3">
          <span>Estado: {d.project.status}</span>
          {d.project.centerLat != null && d.project.centerLng != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {d.project.centerLat.toFixed(3)} /{" "}
              {d.project.centerLng.toFixed(3)}
            </span>
          )}
        </div>
      </div>

      {d.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Alertas abiertas
          </h3>
          {d.alerts.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    PRIORITY_TONE[a.priority] ?? PRIORITY_TONE.low
                  }`}
                >
                  {a.priority.toUpperCase()}
                </span>
                <span className="font-medium text-sm">{a.title}</span>
              </div>
              {a.description && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {a.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {d.pedimentos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Pedimentos ({d.pedimentos.length})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Nombre</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">Área (ha)</th>
                  <th className="text-left p-2">Juzgado</th>
                  <th className="text-left p-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {d.pedimentos.map((p) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="p-2 font-medium">{p.nombre}</td>
                    <td className="p-2">{p.estado}</td>
                    <td className="p-2">{p.areaHa.toLocaleString("es-CL")}</td>
                    <td className="p-2">{p.juzgado ?? "—"}</td>
                    <td className="p-2 text-muted-foreground max-w-sm">{p.notas ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Ficha técnica</h3>
          {sections.map(([section, facts]) => (
            <div key={section} className="rounded-lg border border-border p-3">
              <div className="text-xs font-semibold text-gold uppercase tracking-wide mb-2">
                {FACT_SECTION_LABELS[section]}
              </div>
              <dl className="space-y-1.5">
                {facts.map((f) => (
                  <div
                    key={f.id}
                    className="grid grid-cols-[10rem_1fr_auto] gap-2 text-xs items-baseline"
                  >
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd>
                      {f.value}
                      {f.unit ? ` ${f.unit}` : ""}
                      {f.note && (
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          {f.note}
                        </span>
                      )}
                    </dd>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap ${PROVENANCE_TONE[f.provenance]}`}
                    >
                      {PROVENANCE_LABELS[f.provenance]}
                    </span>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
