// Panel de screening de sanciones (OFAC/UN/EU/UK) — solo visible para staff GC.
// Registra screenings y refresca el checklist REICON (ítem sanctions_screening).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

type ScreeningRow = {
  id: string;
  subject_name: string;
  subject_type: "company" | "ubo" | "individual";
  lists_checked: string[];
  outcome: "clear" | "hit" | "pending";
  matched_details: string | null;
  notes: string | null;
  screened_by: string | null;
  screened_at: string;
};

const LISTS = ["OFAC", "UN", "EU", "UK"] as const;

const OUTCOME_STYLE: Record<
  ScreeningRow["outcome"],
  { label: string; cls: string; Icon: typeof ShieldCheck }
> = {
  clear: {
    label: "Clear",
    cls: "border-emerald-400 bg-emerald-50 text-emerald-700",
    Icon: ShieldCheck,
  },
  hit: { label: "Hit", cls: "border-red-400 bg-red-50 text-red-700", Icon: ShieldAlert },
  pending: {
    label: "Pending",
    cls: "border-neutral-300 bg-neutral-50 text-neutral-600",
    Icon: ShieldQuestion,
  },
};

const TYPE_LABEL: Record<ScreeningRow["subject_type"], string> = {
  company: "Empresa",
  ubo: "UBO",
  individual: "Persona",
};

export function TradeScreeningPanel({ tradeId }: { tradeId: string }) {
  const { isAdmin, loading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subjectName: "",
    subjectType: "company" as ScreeningRow["subject_type"],
    lists: ["OFAC", "UN", "EU", "UK"] as string[],
    outcome: "clear" as ScreeningRow["outcome"],
    matchedDetails: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["trade-screenings", tradeId],
    queryFn: async (): Promise<ScreeningRow[]> => {
      const { data, error } = await supabase.rpc("get_trade_screenings", { p_trade_id: tradeId });
      if (error) throw new Error(error.message);
      return (data ?? []) as ScreeningRow[];
    },
    enabled: isAdmin && !!tradeId,
    staleTime: 15_000,
  });

  if (loading || !isAdmin) return null;

  const toggleList = (l: string) =>
    setForm((f) => ({
      ...f,
      lists: f.lists.includes(l) ? f.lists.filter((x) => x !== l) : [...f.lists, l],
    }));

  const submit = async () => {
    if (!form.subjectName.trim()) {
      toast.error("Ingresa el sujeto (empresa, UBO o persona).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_trade_screening", {
        p_trade_id: tradeId,
        p_subject_name: form.subjectName.trim(),
        p_subject_type: form.subjectType,
        p_lists: form.lists,
        p_outcome: form.outcome,
        p_matched_details: form.matchedDetails.trim() || undefined,
        p_notes: form.notes.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      toast.success("Screening registrado.");
      setShowForm(false);
      setForm({
        subjectName: "",
        subjectType: "company",
        lists: ["OFAC", "UN", "EU", "UK"],
        outcome: "clear",
        matchedDetails: "",
        notes: "",
      });
      await Promise.all([
        q.refetch(),
        qc.invalidateQueries({ queryKey: ["trade-checklist", tradeId] }),
        qc.invalidateQueries({ queryKey: ["trade-readiness", tradeId] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el screening.");
    } finally {
      setSaving(false);
    }
  };

  const rows = q.data ?? [];

  return (
    <section className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl">Screening de sanciones</h2>
          <p className="text-xs text-muted-foreground">
            OFAC · UN · EU · UK. Satisface el ítem obligatorio del checklist (rol Geocapitals). Un
            solo "hit" bloquea la operación.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Registrar screening
        </button>
      </header>

      {showForm && (
        <div className="rounded border border-[hsl(var(--im-hairline,var(--border)))] bg-neutral-50 p-3 grid sm:grid-cols-2 gap-2">
          <label className="text-xs sm:col-span-2">
            <span className="block text-muted-foreground mb-1">Sujeto</span>
            <input
              value={form.subjectName}
              onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
              placeholder="Ej: ACME Copper SpA / Juan Pérez (UBO)"
              className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Tipo</span>
            <select
              value={form.subjectType}
              onChange={(e) =>
                setForm({ ...form, subjectType: e.target.value as ScreeningRow["subject_type"] })
              }
              className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
            >
              <option value="company">Empresa</option>
              <option value="ubo">UBO</option>
              <option value="individual">Persona</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Resultado</span>
            <select
              value={form.outcome}
              onChange={(e) =>
                setForm({ ...form, outcome: e.target.value as ScreeningRow["outcome"] })
              }
              className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
            >
              <option value="clear">Clear (sin coincidencias)</option>
              <option value="hit">Hit (bloquea)</option>
              <option value="pending">Pending (no satisface)</option>
            </select>
          </label>
          <div className="text-xs sm:col-span-2">
            <span className="block text-muted-foreground mb-1">Listas verificadas</span>
            <div className="flex flex-wrap gap-2">
              {LISTS.map((l) => (
                <label
                  key={l}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer ${
                    form.lists.includes(l)
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-border bg-white text-neutral-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.lists.includes(l)}
                    onChange={() => toggleList(l)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs sm:col-span-2">
            <span className="block text-muted-foreground mb-1">
              Detalle de coincidencias (si hay hit)
            </span>
            <input
              value={form.matchedDetails}
              onChange={(e) => setForm({ ...form, matchedDetails: e.target.value })}
              placeholder="Ej: Coincidencia parcial OFAC SDN — verificar RUT"
              className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="block text-muted-foreground mb-1">Notas internas</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 inline-flex items-center gap-1 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Registrar
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando screenings…</div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-dashed border-[hsl(var(--im-hairline,var(--border)))] p-4 text-sm text-muted-foreground text-center">
          Sin screenings registrados. El ítem "Screening de sanciones" del checklist queda en estado
          "falta" hasta que registres al menos un chequeo con outcome clear.
        </div>
      ) : (
        <ul className="divide-y divide-[hsl(var(--im-hairline,var(--border)))]">
          {rows.map((r) => {
            const s = OUTCOME_STYLE[r.outcome];
            const { Icon } = s;
            return (
              <li key={r.id} className="py-2.5 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.subject_name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      · {TYPE_LABEL[r.subject_type]}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${s.cls}`}
                    >
                      <Icon className="w-3 h-3" />
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.lists_checked.map((l) => (
                      <span
                        key={l}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  {r.matched_details && (
                    <p className="text-xs text-red-700 mt-1">⚠ {r.matched_details}</p>
                  )}
                  {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                    {new Date(r.screened_at).toLocaleString("es-CL")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
