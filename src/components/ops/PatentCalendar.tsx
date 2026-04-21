import { useMemo, useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { HudPanel } from "@/components/ops/HudPanel";
import { StatusDot } from "@/components/ops/StatusDot";
import {
  useConcessionPatents,
  patentDisplayStatus,
  PATENT_COLORS,
  PATENT_LABELS,
  type ConcessionPatent,
  type PatentStatus,
} from "@/hooks/useConcessionPatents";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const UTM_TO_CLP = 67429; // referencia oct-2025
const CLP_TO_USD = 1 / 950;

export function PatentCalendar({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const { data, loading, refresh } = useConcessionPatents(projectId);
  const { data: concessions } = useMiningConcessions(projectId);
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    let totalUtm = 0, paid = 0, overdue = 0, upcoming = 0;
    for (const p of data) {
      totalUtm += Number(p.amount_utm || 0);
      const st = patentDisplayStatus(p);
      if (st === "paid") paid++;
      else if (st === "overdue") overdue++;
      else if (st === "upcoming") upcoming++;
    }
    return { totalUtm, paid, overdue, upcoming };
  }, [data]);

  const grouped = useMemo(() => {
    const m = new Map<number, ConcessionPatent[]>();
    for (const p of data) {
      const arr = m.get(p.year) ?? [];
      arr.push(p);
      m.set(p.year, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [data]);

  const concessionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of concessions) m.set(c.id, `${c.code} — ${c.name}`);
    return m;
  }, [concessions]);

  const onMarkPaid = async (p: ConcessionPatent) => {
    const { error } = await supabase
      .from("concession_patents")
      .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Patente marcada como pagada"); refresh(); }
  };

  return (
    <HudPanel
      title="Patentes mineras · Calendario"
      accent="amber"
      className="bg-bg-panel/40"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Stat label="Total UTM" value={stats.totalUtm.toLocaleString("es-CL")} />
        <Stat label="≈ CLP" value={(stats.totalUtm * UTM_TO_CLP).toLocaleString("es-CL", { maximumFractionDigits: 0 })} />
        <Stat label="≈ USD" value={(stats.totalUtm * UTM_TO_CLP * CLP_TO_USD).toFixed(0)} />
        <Stat label="Vencidas" value={String(stats.overdue)} color={stats.overdue > 0 ? "var(--signal-red)" : undefined} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <StatusDot status="ok" label={`${stats.paid} pagadas`} />
          <StatusDot status="warn" label={`${stats.upcoming} <60d`} />
          <StatusDot status="crit" label={`${stats.overdue} vencidas`} />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-border bg-bg-panel text-[10px] font-mono uppercase hover:bg-accent"
        >
          <Plus className="w-3 h-3" /> Nueva patente
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-[11px] font-mono text-text-dim">CARGANDO…</div>
      ) : data.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-[2px]">
          <div className="text-[11px] font-mono text-text-dim">Sin patentes registradas. Agrega la primera para activar el calendario.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([year, patents]) => (
            <div key={year}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">
                Año {year} · {patents.length} patente{patents.length === 1 ? "" : "s"}
              </div>
              <div className="border border-border rounded-[2px] divide-y divide-border">
                {patents.map((p) => {
                  const st = patentDisplayStatus(p);
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent/30">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: PATENT_COLORS[st] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono truncate">
                          {concessionMap.get(p.concession_id) ?? p.concession_id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-text-dim">
                          {p.amount_utm} UTM · vence {p.due_date ?? "—"}
                          {p.paid_at && ` · pagada ${p.paid_at}`}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: PATENT_COLORS[st] }}>
                        {PATENT_LABELS[st]}
                      </span>
                      {st !== "paid" && (
                        <button
                          onClick={() => onMarkPaid(p)}
                          className="p-1 rounded hover:bg-signal-green/20 text-signal-green"
                          title="Marcar pagada"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <PatentDialog
          projectId={projectId}
          userId={userId}
          concessions={concessions.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }))}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); refresh(); }}
        />
      )}
    </HudPanel>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded-[2px] p-2 bg-bg-panel/50">
      <div className="text-[9px] font-mono uppercase tracking-wider text-text-dim">{label}</div>
      <div className="text-sm font-mono font-semibold" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function PatentDialog({
  projectId,
  userId,
  concessions,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  concessions: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    concession_id: concessions[0]?.id ?? "",
    year: new Date().getFullYear(),
    amount_utm: "",
    due_date: `${new Date().getFullYear()}-03-31`,
    status: "pending" as PatentStatus,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!form.concession_id) return toast.error("Selecciona una concesión");
    if (!form.amount_utm) return toast.error("Monto UTM requerido");
    setSaving(true);
    const utm = Number(form.amount_utm);
    const { error } = await supabase.from("concession_patents").insert({
      project_id: projectId,
      created_by: userId,
      concession_id: form.concession_id,
      year: form.year,
      amount_utm: utm,
      amount_clp: utm * UTM_TO_CLP,
      amount_usd: utm * UTM_TO_CLP * CLP_TO_USD,
      due_date: form.due_date || null,
      status: form.status === "upcoming" ? "pending" : form.status,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Patente creada"); onSaved(); }
  };

  const inp = "w-full px-2 py-1 text-[11px] font-mono bg-bg-panel border border-border rounded-[2px] focus:outline-none focus:ring-1 focus:ring-signal-cyan";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono uppercase tracking-wider">Nueva patente</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Concesión</label>
            <select className={inp} value={form.concession_id} onChange={(e) => setForm({ ...form, concession_id: e.target.value })}>
              {concessions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Año</label>
              <input type="number" className={inp} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Monto UTM</label>
              <input type="number" step="0.01" className={inp} value={form.amount_utm} onChange={(e) => setForm({ ...form, amount_utm: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Vencimiento</label>
            <input type="date" className={inp} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Notas</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[11px] font-mono uppercase border border-border rounded-[2px] hover:bg-accent">Cancelar</button>
            <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-[11px] font-mono uppercase bg-signal-cyan text-bg-deep rounded-[2px] disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
