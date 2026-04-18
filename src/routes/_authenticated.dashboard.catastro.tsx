import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Search, Trash2, Pencil, MapPin } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import {
  useMiningConcessions,
  daysUntilExpiry,
  expiryStatus,
  EXPIRY_COLORS,
  EXPIRY_LABELS,
  intersectsAoiBbox,
  type MiningConcession,
  type ExpiryStatus,
} from "@/hooks/useMiningConcessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  head: () => ({ meta: [{ title: "Catastro minero — Geocapitals" }] }),
  component: CatastroModule,
});

const TYPE_LABELS: Record<string, string> = {
  exploracion: "Exploración",
  explotacion: "Explotación",
  pertenencia: "Pertenencia",
  manifestacion: "Manifestación",
};

const STATUS_LABELS: Record<string, string> = {
  vigente: "Vigente",
  en_tramite: "En trámite",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

// Hardcoded AOI from project for demo intersection (Palmeras prospect)
const PROJECT_AOI: [number, number][] = [
  [-71.1225, -33.9036],
  [-71.1108, -33.9015],
  [-71.1084, -33.8932],
  [-71.1201, -33.8953],
  [-71.1225, -33.9036],
];

function CatastroModule() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { data, loading, refresh } = useMiningConcessions(active?.id ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ExpiryStatus | "all">("all");
  const [editing, setEditing] = useState<MiningConcession | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((c) => {
      if (s && !c.code.toLowerCase().includes(s) && !c.name.toLowerCase().includes(s)) return false;
      if (filter !== "all" && expiryStatus(c.expires_at) !== filter) return false;
      return true;
    });
  }, [data, search, filter]);

  const stats = useMemo(() => {
    const total = data.length;
    let vigentes = 0, vencidas = 0, lt90 = 0, areaTotal = 0;
    for (const c of data) {
      const s = expiryStatus(c.expires_at);
      if (s === "ok") vigentes++;
      if (s === "expired") vencidas++;
      if (s === "warning" || s === "critical") lt90++;
      if (c.area_ha) areaTotal += Number(c.area_ha);
    }
    return { total, vigentes, vencidas, lt90, areaTotal };
  }, [data]);

  const alerts = useMemo(
    () => data.filter((c) => {
      const s = expiryStatus(c.expires_at);
      return s === "warning" || s === "critical" || s === "expired";
    }),
    [data]
  );

  if (!active) {
    return (
      <div className="p-6 text-text-secondary">Selecciona un proyecto para ver su catastro minero.</div>
    );
  }

  const onDelete = async (c: MiningConcession) => {
    if (!confirm(`¿Eliminar concesión "${c.code}"?`)) return;
    const { error } = await supabase.from("mining_concessions").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Concesión eliminada");
      refresh();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Catastro minero</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Concesiones del proyecto · {active.code} · {active.name}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nueva concesión
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Vigentes" value={String(stats.vigentes)} color="#0d9488" />
        <Stat label="Vence <90d" value={String(stats.lt90)} color="#f59e0b" />
        <Stat label="Vencidas" value={String(stats.vencidas)} color="#dc2626" />
        <Stat label="Área total (ha)" value={stats.areaTotal.toFixed(1)} />
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded p-3">
          <div className="flex items-center gap-2 text-amber-600 font-medium text-sm mb-1.5">
            <AlertTriangle className="w-4 h-4" /> {alerts.length} concesión{alerts.length === 1 ? "" : "es"} con alerta de vencimiento
          </div>
          <div className="space-y-1 text-xs">
            {alerts.slice(0, 5).map((c) => {
              const d = daysUntilExpiry(c.expires_at);
              return (
                <div key={c.id} className="flex justify-between">
                  <span><strong>{c.code}</strong> — {c.name}</span>
                  <span style={{ color: EXPIRY_COLORS[expiryStatus(c.expires_at)] }}>
                    {d !== null && d < 0 ? `Vencida hace ${Math.abs(d)}d` : `Vence en ${d}d (${c.expires_at})`}
                  </span>
                </div>
              );
            })}
            {alerts.length > 5 && <div className="text-text-secondary">…y {alerts.length - 5} más</div>}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o nombre…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "expired", "critical", "warning", "ok", "none"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-bg-secondary border-border hover:bg-accent"
              }`}
            >
              {f === "all" ? "Todas" : EXPIRY_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-text-secondary text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            {data.length === 0 ? "Sin concesiones todavía. Crea la primera." : "Sin resultados con esos filtros."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg-secondary border-b border-border">
                <tr className="text-left">
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Titular</Th>
                  <Th>Tipo</Th>
                  <Th>Estado</Th>
                  <Th>Vencimiento</Th>
                  <Th>Área (ha)</Th>
                  <Th>AOI</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = expiryStatus(c.expires_at);
                  const days = daysUntilExpiry(c.expires_at);
                  const color = EXPIRY_COLORS[st];
                  const intersects = intersectsAoiBbox(c.geometry_geojson, PROJECT_AOI);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <Td><span className="font-mono font-medium">{c.code}</span></Td>
                      <Td>{c.name}</Td>
                      <Td>{c.holder ?? "—"}</Td>
                      <Td>{TYPE_LABELS[c.concession_type] ?? c.concession_type}</Td>
                      <Td>{STATUS_LABELS[c.status] ?? c.status}</Td>
                      <Td>
                        <span style={{ color }} className="font-medium">
                          {c.expires_at ?? "—"}
                          {days !== null && (
                            <span className="ml-1 text-[10px] opacity-80">
                              ({days < 0 ? `${Math.abs(days)}d vencida` : `${days}d`})
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td>{c.area_ha ?? "—"}</Td>
                      <Td>
                        {intersects ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <MapPin className="w-3 h-3" /> Sí
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setEditing(c)}
                            className="p-1 rounded hover:bg-accent"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(c)}
                            className="p-1 rounded hover:bg-destructive/20 text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && user && active && (
        <ConcessionDialog
          projectId={active.id}
          userId={user.id}
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded p-2.5 bg-bg-secondary/30">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-lg font-semibold" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2.5 py-1.5">{children}</td>;
}

function ConcessionDialog({
  projectId,
  userId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  initial: MiningConcession | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    holder: initial?.holder ?? "",
    concession_type: initial?.concession_type ?? "explotacion",
    status: initial?.status ?? "vigente",
    area_ha: initial?.area_ha?.toString() ?? "",
    granted_at: initial?.granted_at ?? "",
    expires_at: initial?.expires_at ?? "",
    region: initial?.region ?? "",
    commune: initial?.commune ?? "",
    notes: initial?.notes ?? "",
    geometry: initial?.geometry_geojson ? JSON.stringify(initial.geometry_geojson, null, 2) : "",
  });
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Código y nombre son requeridos");
      return;
    }
    let geometry: unknown = null;
    if (form.geometry.trim()) {
      try {
        geometry = JSON.parse(form.geometry);
      } catch {
        toast.error("GeoJSON inválido");
        return;
      }
    }
    setSaving(true);
    const payload = {
      project_id: projectId,
      created_by: userId,
      code: form.code.trim(),
      name: form.name.trim(),
      holder: form.holder.trim() || null,
      concession_type: form.concession_type,
      status: form.status,
      area_ha: form.area_ha ? Number(form.area_ha) : null,
      granted_at: form.granted_at || null,
      expires_at: form.expires_at || null,
      region: form.region.trim() || null,
      commune: form.commune.trim() || null,
      notes: form.notes.trim() || null,
      geometry_geojson: geometry as never,
      source: initial?.source ?? "manual",
    };
    const { error } = initial
      ? await supabase.from("mining_concessions").update(payload).eq("id", initial.id)
      : await supabase.from("mining_concessions").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(initial ? "Concesión actualizada" : "Concesión creada");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar concesión" : "Nueva concesión"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" required>
            <input className={inp} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Nombre" required>
            <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Titular">
            <input className={inp} value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <select className={inp} value={form.concession_type} onChange={(e) => setForm({ ...form, concession_type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Área (ha)">
            <input type="number" step="0.01" className={inp} value={form.area_ha} onChange={(e) => setForm({ ...form, area_ha: e.target.value })} />
          </Field>
          <Field label="Otorgamiento">
            <input type="date" className={inp} value={form.granted_at} onChange={(e) => setForm({ ...form, granted_at: e.target.value })} />
          </Field>
          <Field label="Vencimiento">
            <input type="date" className={inp} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </Field>
          <Field label="Región">
            <input className={inp} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <Field label="Comuna">
            <input className={inp} value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Notas">
              <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label='Geometría GeoJSON (Polygon o MultiPolygon, opcional)'>
              <textarea
                rows={4}
                className={`${inp} font-mono text-[11px]`}
                placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
                value={form.geometry}
                onChange={(e) => setForm({ ...form, geometry: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inp = "w-full px-2 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
