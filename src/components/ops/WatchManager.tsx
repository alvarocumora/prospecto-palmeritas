import { useState } from "react";
import { Plus, Trash2, Power } from "lucide-react";
import { HudPanel } from "@/components/ops/HudPanel";
import { useBulletinWatches, WATCH_TYPE_LABELS, type WatchType } from "@/hooks/useBulletinWatches";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function WatchManager({ projectId, userId }: { projectId: string; userId: string }) {
  const { data, loading, refresh } = useBulletinWatches(projectId);
  const [open, setOpen] = useState(false);

  const onToggle = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("bulletin_watches")
      .update({ is_active: !active })
      .eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar este watch?")) return;
    const { error } = await supabase.from("bulletin_watches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Watch eliminado");
      refresh();
    }
  };

  const grouped = data.reduce<Record<WatchType, typeof data>>(
    (acc, w) => {
      const k = w.watch_type as WatchType;
      if (!acc[k]) acc[k] = [];
      acc[k].push(w);
      return acc;
    },
    {} as Record<WatchType, typeof data>,
  );

  return (
    <HudPanel title="Vigilancia · Boletín minero + PJUD" accent="violet" className="bg-bg-panel/40">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          {data.filter((w) => w.is_active).length} de {data.length} activos
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-border bg-bg-panel text-[10px] font-mono uppercase hover:bg-accent"
        >
          <Plus className="w-3 h-3" /> Agregar watch
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-[11px] font-mono text-text-dim">CARGANDO…</div>
      ) : data.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-[2px]">
          <div className="text-[11px] font-mono text-text-dim">
            Sin watches configurados. Agrega titulares, códigos o regiones para recibir alertas
            automáticas del Boletín Minero.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(WATCH_TYPE_LABELS) as WatchType[]).map((type) => {
            const items = grouped[type] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={type}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">
                  {WATCH_TYPE_LABELS[type]} · {items.length}
                </div>
                <div className="border border-border rounded-[2px] divide-y divide-border">
                  {items.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent/30"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          w.is_active ? "bg-signal-green" : "bg-text-dim"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono truncate">{w.label || w.value}</div>
                        {w.label && (
                          <div className="text-[10px] text-text-dim truncate">{w.value}</div>
                        )}
                      </div>
                      <button
                        onClick={() => onToggle(w.id, w.is_active)}
                        className="p-1 rounded hover:bg-accent"
                        title={w.is_active ? "Desactivar" : "Activar"}
                      >
                        <Power
                          className={`w-3.5 h-3.5 ${w.is_active ? "text-signal-green" : "text-text-dim"}`}
                        />
                      </button>
                      <button
                        onClick={() => onDelete(w.id)}
                        className="p-1 rounded hover:bg-signal-red/20 text-signal-red"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <WatchDialog
          projectId={projectId}
          userId={userId}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
    </HudPanel>
  );
}

function WatchDialog({
  projectId,
  userId,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    watch_type: "holder" as WatchType,
    value: "",
    label: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!form.value.trim()) return toast.error("Valor requerido");
    setSaving(true);
    const { error } = await supabase.from("bulletin_watches").insert({
      project_id: projectId,
      created_by: userId,
      watch_type: form.watch_type,
      value: form.value.trim(),
      label: form.label.trim() || null,
      notes: form.notes.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Watch creado");
      onSaved();
    }
  };

  const inp =
    "w-full px-2 py-1 text-[11px] font-mono bg-bg-panel border border-border rounded-[2px] focus:outline-none focus:ring-1 focus:ring-signal-cyan";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono uppercase tracking-wider">
            Nuevo watch
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Tipo</label>
            <select
              className={inp}
              value={form.watch_type}
              onChange={(e) => setForm({ ...form, watch_type: e.target.value as WatchType })}
            >
              {(Object.entries(WATCH_TYPE_LABELS) as Array<[WatchType, string]>).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">
              {form.watch_type === "holder"
                ? "Nombre o RUT"
                : form.watch_type === "code"
                  ? "Código de concesión"
                  : form.watch_type === "region"
                    ? "Región o comuna"
                    : "Keyword judicial"}
            </label>
            <input
              className={inp}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">
              Etiqueta (opcional)
            </label>
            <input
              className={inp}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Notas</label>
            <textarea
              className={inp}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-mono uppercase border border-border rounded-[2px] hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1.5 text-[11px] font-mono uppercase bg-signal-cyan text-bg-deep rounded-[2px] disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
