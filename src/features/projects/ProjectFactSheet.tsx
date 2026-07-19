import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  getProjectFactSheet,
  saveProjectFactSheet,
  type ProjectFact,
} from "@/lib/factSheet.functions";
import {
  FACT_SECTIONS,
  FACT_SECTION_LABELS,
  PROVENANCE_STATES,
  PROVENANCE_LABELS,
  PROVENANCE_TONE,
  summarizeProvenance,
  type FactSection,
  type Provenance,
} from "@/lib/provenance";

type Draft = Omit<ProjectFact, "id"> & { id?: string };

const NEW_FACT: Draft = {
  section: "activo",
  label: "",
  value: "",
  unit: "",
  provenance: "a_verificar",
  source: "",
  note: "",
};

export function ProjectFactSheet({ projectId }: { projectId: string }) {
  const getFn = useServerFn(getProjectFactSheet);
  const saveFn = useServerFn(saveProjectFactSheet);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["project-facts", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    staleTime: 30_000,
  });

  const [facts, setFacts] = useState<Draft[]>([]);
  useEffect(() => {
    if (data) setFacts(data.facts);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          projectId,
          facts: facts
            .filter((f) => f.label.trim())
            .map((f) => ({
              section: f.section,
              label: f.label.trim(),
              value: f.value?.trim() || null,
              unit: f.unit?.trim() || null,
              provenance: f.provenance,
              source: f.source?.trim() || null,
              note: f.note?.trim() || null,
            })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Ficha de datos guardada (${res.count} datos).`);
      void qc.invalidateQueries({ queryKey: ["project-facts", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar."),
  });

  const canEdit = data?.canEdit ?? false;
  const summary = summarizeProvenance(facts);

  const setRow = (i: number, patch: Partial<Draft>) =>
    setFacts((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addRow = () => setFacts((fs) => [...fs, { ...NEW_FACT }]);
  const removeRow = (i: number) => setFacts((fs) => fs.filter((_, j) => j !== i));

  if (isLoading) return <div className="h-40 rounded bg-muted/20 animate-pulse" />;

  return (
    <section className="rounded-md border border-border bg-bg-secondary/20 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Ficha de datos · procedencia</h2>
        </div>
        {/* Semáforo resumen */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700">
            {summary.certificado} certificado
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">
            {summary.declarado} declarado
          </span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-700">
            {summary.aVerificar} a verificar
          </span>
          <span className="text-muted-foreground">· {summary.certifiedPct}% cert.</span>
        </div>
      </div>

      {data?.pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          La ficha de datos estará disponible cuando se aplique la migración{" "}
          <code>project_facts</code>.
        </div>
      )}

      {summary.aVerificar > 0 && (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-2.5 text-[11px] text-red-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {summary.aVerificar} dato{summary.aVerificar === 1 ? "" : "s"} pendiente
          {summary.aVerificar === 1 ? "" : "s"} de verificación — checklist de due diligence.
        </div>
      )}

      {facts.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">
          Sin datos. Agrega características, superficie, leyes, reservas… cada uno con su
          procedencia.
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((f, i) => (
            <div
              key={f.id ?? i}
              className={`rounded border p-2.5 ${PROVENANCE_TONE[f.provenance].split(" ").slice(1).join(" ")}`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                <select
                  value={f.section}
                  disabled={!canEdit}
                  onChange={(e) => setRow(i, { section: e.target.value as FactSection })}
                  className="sm:col-span-2 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                >
                  {FACT_SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {FACT_SECTION_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  value={f.label}
                  disabled={!canEdit}
                  placeholder="Dato (ej. Superficie cateo)"
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  className="sm:col-span-3 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                />
                <input
                  value={f.value ?? ""}
                  disabled={!canEdit}
                  placeholder="Valor (ej. 6.250)"
                  onChange={(e) => setRow(i, { value: e.target.value })}
                  className="sm:col-span-2 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                />
                <input
                  value={f.unit ?? ""}
                  disabled={!canEdit}
                  placeholder="Unidad (ha, g/t)"
                  onChange={(e) => setRow(i, { unit: e.target.value })}
                  className="sm:col-span-1 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                />
                <select
                  value={f.provenance}
                  disabled={!canEdit}
                  onChange={(e) => setRow(i, { provenance: e.target.value as Provenance })}
                  className="sm:col-span-2 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                >
                  {PROVENANCE_STATES.map((s) => (
                    <option key={s} value={s}>
                      {PROVENANCE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-2 flex items-center gap-1">
                  <input
                    value={f.source ?? ""}
                    disabled={!canEdit}
                    placeholder="Fuente"
                    onChange={(e) => setRow(i, { source: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60"
                  />
                  {canEdit && (
                    <button
                      onClick={() => removeRow(i)}
                      className="shrink-0 p-1.5 rounded border border-border hover:bg-accent"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={addRow}
            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar dato
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "Guardando…" : "Guardar ficha de datos"}
          </button>
        </div>
      )}
    </section>
  );
}
