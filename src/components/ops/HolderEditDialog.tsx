import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ConcessionHolder } from "@/hooks/useHolders";

export function HolderEditDialog({
  holder,
  projectId,
  userId,
  onClose,
  onSaved,
}: {
  holder: ConcessionHolder | null;
  projectId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: holder?.name ?? "",
    rut: holder?.rut ?? "",
    holder_type: holder?.holder_type ?? "sociedad",
    legal_repr_name: holder?.legal_repr_name ?? "",
    legal_repr_rut: holder?.legal_repr_rut ?? "",
    address: holder?.address ?? "",
    commune: holder?.commune ?? "",
    region: holder?.region ?? "",
    email: holder?.email ?? "",
    phone: holder?.phone ?? "",
    website: holder?.website ?? "",
    economic_activity: holder?.economic_activity ?? "",
    incorporation_date: holder?.incorporation_date ?? "",
    notes: holder?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    const payload = {
      project_id: projectId,
      name: form.name.trim(),
      rut: form.rut.trim() || null,
      holder_type: form.holder_type,
      legal_repr_name: form.legal_repr_name || null,
      legal_repr_rut: form.legal_repr_rut || null,
      address: form.address || null,
      commune: form.commune || null,
      region: form.region || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      economic_activity: form.economic_activity || null,
      incorporation_date: form.incorporation_date || null,
      notes: form.notes || null,
    };
    const { error } = holder
      ? await supabase.from("concession_holders").update(payload).eq("id", holder.id)
      : await supabase.from("concession_holders").insert({ ...payload, created_by: userId });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(holder ? "Titular actualizado" : "Titular creado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{holder ? "Editar titular" : "Nuevo titular"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Nombre / Razón social *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="RUT" value={form.rut} onChange={(v) => setForm({ ...form, rut: v })} mono />
          <div>
            <label className="text-[11px] text-text-secondary uppercase tracking-wider">Tipo</label>
            <select
              value={form.holder_type}
              onChange={(e) => setForm({ ...form, holder_type: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-sm"
            >
              <option value="sociedad">Sociedad</option>
              <option value="persona">Persona natural</option>
              <option value="comunidad">Comunidad</option>
            </select>
          </div>
          <Field label="Fecha constitución" value={form.incorporation_date} onChange={(v) => setForm({ ...form, incorporation_date: v })} type="date" />
          <Field label="Repr. legal" value={form.legal_repr_name} onChange={(v) => setForm({ ...form, legal_repr_name: v })} />
          <Field label="RUT repr. legal" value={form.legal_repr_rut} onChange={(v) => setForm({ ...form, legal_repr_rut: v })} mono />
          <Field label="Giro / Actividad" value={form.economic_activity} onChange={(v) => setForm({ ...form, economic_activity: v })} className="md:col-span-2" />
          <Field label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} className="md:col-span-2" />
          <Field label="Comuna" value={form.commune} onChange={(v) => setForm({ ...form, commune: v })} />
          <Field label="Región" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Sitio web" value={form.website} onChange={(v) => setForm({ ...form, website: v })} className="md:col-span-2" />
          <div className="md:col-span-2">
            <label className="text-[11px] text-text-secondary uppercase tracking-wider">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full mt-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border text-sm hover:bg-accent">Cancelar</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] text-text-secondary uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full mt-1 px-2 py-1.5 bg-bg-secondary border border-border rounded text-sm ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
