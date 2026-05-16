import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, Plus, Pencil, Trash2, Link2, Activity, Drill, TestTube2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import {
  useExplorationCampaigns,
  PHASE_LABELS,
  type ExplorationCampaign,
} from "@/hooks/useExplorationCampaigns";

export const Route = createFileRoute("/_authenticated/dashboard/campaigns")({
  head: () => ({ meta: [{ title: "Campañas de exploración — Geocapitals" }] }),
  component: CampaignsModule,
});

const PHASES = ["recon", "scoping", "pea", "pfs", "fs"] as const;
const STATUSES = ["active", "paused", "completed", "archived"] as const;
const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  paused: "Pausada",
  completed: "Completada",
  archived: "Archivada",
};

function CampaignsModule() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { data, loading, refresh } = useExplorationCampaigns(active?.id ?? null);
  const [editing, setEditing] = useState<ExplorationCampaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ExplorationCampaign | null>(null);

  const onDelete = async (c: ExplorationCampaign) => {
    if (!confirm(`Eliminar campaña "${c.name}"? (Surveys/sondajes/muestras quedarán sin asignar)`))
      return;
    const { error } = await supabase.from("exploration_campaigns").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campaña eliminada");
    refresh();
  };

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Proyecto · {active.code}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" /> Campañas de exploración
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Agrupa surveys geofísicos, sondajes y muestras por campaña/fase.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva campaña
        </button>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : data.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aún no hay campañas. Crea la primera para organizar tus actividades.
          </p>
        </div>
      ) : (
        <div className="rounded border border-border bg-bg-secondary divide-y divide-border">
          {data.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center gap-4 hover:bg-accent/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold truncate">{c.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-border bg-background">
                    {PHASE_LABELS[c.phase] ?? c.phase}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {c.started_at ? new Date(c.started_at).toLocaleDateString() : "—"}
                  {" → "}
                  {c.ended_at ? new Date(c.ended_at).toLocaleDateString() : "en curso"}
                  {c.notes && <span className="ml-2 truncate">· {c.notes}</span>}
                </div>
              </div>
              <CampaignCounts campaignId={c.id} />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAssignTarget(c)}
                  title="Asignar items"
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-gold"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditing(c)}
                  title="Editar"
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-info"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(c)}
                  title="Eliminar"
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && user && (
        <CampaignDialog
          projectId={active.id}
          userId={user.id}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
      {assignTarget && (
        <AssignDialog
          projectId={active.id}
          campaign={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}

/* ---------- counts pill ---------- */
function CampaignCounts({ campaignId }: { campaignId: string }) {
  const [counts, setCounts] = useState<{ surveys: number; holes: number; samples: number } | null>(
    null,
  );
  useEffect(() => {
    (async () => {
      const [s, h, m] = await Promise.all([
        supabase
          .from("geophysics_surveys")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
        supabase
          .from("drill_holes")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
        supabase
          .from("sampling_results")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
      ]);
      setCounts({ surveys: s.count ?? 0, holes: h.count ?? 0, samples: m.count ?? 0 });
    })();
  }, [campaignId]);
  if (!counts) return <div className="w-32" />;
  return (
    <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Activity className="w-3 h-3" />
        {counts.surveys}
      </span>
      <span className="inline-flex items-center gap-1">
        <Drill className="w-3 h-3" />
        {counts.holes}
      </span>
      <span className="inline-flex items-center gap-1">
        <TestTube2 className="w-3 h-3" />
        {counts.samples}
      </span>
    </div>
  );
}

/* ---------- create/edit dialog ---------- */
function CampaignDialog({
  projectId,
  userId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  initial: ExplorationCampaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phase, setPhase] = useState(initial?.phase ?? "recon");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [startedAt, setStartedAt] = useState(initial?.started_at ?? "");
  const [endedAt, setEndedAt] = useState(initial?.ended_at ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phase,
      status,
      started_at: startedAt || null,
      ended_at: endedAt || null,
      notes: notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("exploration_campaigns").update(payload).eq("id", initial.id)
      : await supabase
          .from("exploration_campaigns")
          .insert({ ...payload, project_id: projectId, created_by: userId });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial ? "Campaña actualizada" : "Campaña creada");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-lg p-5 space-y-3"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-mono font-semibold">
            {initial ? "Editar campaña" : "Nueva campaña"}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <Field label="Nombre" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
            placeholder="Ej. Campaña Recon Q2 2025"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fase">
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
            >
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Inicio">
            <input
              type="date"
              value={startedAt ?? ""}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
            />
          </Field>
          <Field label="Fin">
            <input
              type="date"
              value={endedAt ?? ""}
              onChange={(e) => setEndedAt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
            />
          </Field>
        </div>
        <Field label="Notas">
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-mono text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- assign items dialog ---------- */
type AssignableTable = "geophysics_surveys" | "drill_holes" | "sampling_results";
type AssignableItem = { id: string; label: string; sublabel: string; campaign_id: string | null };

function AssignDialog({
  projectId,
  campaign,
  onClose,
}: {
  projectId: string;
  campaign: ExplorationCampaign;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AssignableTable>("geophysics_surveys");
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const reload = async () => {
    setLoading(true);
    let rows: AssignableItem[] = [];
    if (tab === "geophysics_surveys") {
      const { data } = await supabase
        .from("geophysics_surveys")
        .select("id,name,method,status,campaign_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      rows = (data ?? []).map((r) => ({
        id: r.id,
        label: r.name,
        sublabel: `${r.method.toUpperCase()} · ${r.status}`,
        campaign_id: r.campaign_id,
      }));
    } else if (tab === "drill_holes") {
      const { data } = await supabase
        .from("drill_holes")
        .select("id,hole_id,status,target_zone,campaign_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      rows = (data ?? []).map((r) => ({
        id: r.id,
        label: r.hole_id,
        sublabel: `${r.status}${r.target_zone ? " · " + r.target_zone : ""}`,
        campaign_id: r.campaign_id,
      }));
    } else {
      const { data } = await supabase
        .from("sampling_results")
        .select("id,sample_code,sample_type,zone,au_gpt,campaign_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data ?? []).map((r) => ({
        id: r.id,
        label: r.sample_code,
        sublabel: `${r.sample_type}${r.zone ? " · " + r.zone : ""}${r.au_gpt != null ? " · Au " + r.au_gpt + " g/t" : ""}`,
        campaign_id: r.campaign_id,
      }));
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tab, projectId]);

  const toggle = async (item: AssignableItem) => {
    const newCampaign = item.campaign_id === campaign.id ? null : campaign.id;
    const { error } = await supabase
      .from(tab)
      .update({ campaign_id: newCampaign })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, campaign_id: newCampaign } : i)),
    );
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "assigned") return items.filter((i) => i.campaign_id === campaign.id);
    return items.filter((i) => i.campaign_id == null);
  }, [items, filter, campaign.id]);

  const assignedCount = items.filter((i) => i.campaign_id === campaign.id).length;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-muted-foreground">
              Asignar a campaña
            </div>
            <h2 className="text-sm font-mono font-semibold">{campaign.name}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        <div className="px-4 pt-3 flex items-center gap-1 border-b border-border">
          <TabBtn
            active={tab === "geophysics_surveys"}
            onClick={() => setTab("geophysics_surveys")}
            icon={<Activity className="w-3 h-3" />}
            label="Surveys"
          />
          <TabBtn
            active={tab === "drill_holes"}
            onClick={() => setTab("drill_holes")}
            icon={<Drill className="w-3 h-3" />}
            label="Sondajes"
          />
          <TabBtn
            active={tab === "sampling_results"}
            onClick={() => setTab("sampling_results")}
            icon={<TestTube2 className="w-3 h-3" />}
            label="Muestras"
          />
          <div className="ml-auto pb-2 flex items-center gap-2 text-[10px] font-mono">
            <span className="text-muted-foreground">
              Asignados: <b className="text-gold">{assignedCount}</b>
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-border bg-background"
            >
              <option value="all">Todos</option>
              <option value="assigned">Asignados</option>
              <option value="unassigned">Sin asignar</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-xs font-mono text-muted-foreground p-4 text-center">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs font-mono text-muted-foreground p-4 text-center">
              Sin items.
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((it) => {
                const assignedHere = it.campaign_id === campaign.id;
                const assignedElsewhere = it.campaign_id != null && !assignedHere;
                return (
                  <label
                    key={it.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded border border-border bg-background hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assignedHere}
                      onChange={() => toggle(it)}
                      className="accent-gold"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{it.label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {it.sublabel}
                      </div>
                    </div>
                    {assignedElsewhere && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        otra campaña
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border-b-2 -mb-px ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
