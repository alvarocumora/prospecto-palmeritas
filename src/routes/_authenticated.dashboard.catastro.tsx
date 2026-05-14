import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Search, Trash2, Pencil, MapPin, FileText, Coins, AlertOctagon, Eye, RefreshCw, Building2, Download, Loader2, History } from "lucide-react";
import { ConcessionChangeHistoryPanel } from "@/components/catastro/ConcessionChangeHistoryPanel";
import { ImportConcessionsDialog } from "@/components/ops/ImportConcessionsDialog";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { PatentCalendar } from "@/components/ops/PatentCalendar";
import { OverlapInspector } from "@/components/ops/OverlapInspector";
import { WatchManager } from "@/components/ops/WatchManager";
import { SyncLog } from "@/components/ops/SyncLog";
import { HoldersTab } from "@/components/ops/HoldersTab";
import { MobileTabPicker } from "@/components/ops/MobileTabPicker";
import { ConcessionDetailDrawer } from "@/components/ops/ConcessionDetailDrawer";
import { CatastroMap } from "@/components/ops/CatastroMap";
import { CatastroOverlapPanel } from "@/components/ops/CatastroOverlapPanel";
import { ConcessionAlertsPanel } from "@/components/ops/ConcessionAlertsPanel";
import { AoiOverlapPanel } from "@/components/ops/AoiOverlapPanel";
import { cn } from "@/lib/utils";
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
  component: CatastroPage,
});

type Tab = "concessions" | "holders" | "patents" | "overlaps" | "watches" | "history" | "sync";

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "concessions", label: "Mis concesiones", icon: FileText },
  { id: "holders", label: "Titulares", icon: Building2 },
  { id: "patents", label: "Patentes", icon: Coins },
  { id: "overlaps", label: "Conflictos", icon: AlertOctagon },
  { id: "watches", label: "Vigilancia", icon: Eye },
  { id: "history", label: "Historial", icon: History },
  { id: "sync", label: "Sync log", icon: RefreshCw },
];

function CatastroPage() {
  const { active } = useProjects();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("concessions");
  const [syncing, setSyncing] = useState(false);

  if (!active) {
    return <div className="p-6 text-text-secondary">Selecciona un proyecto para ver su catastro minero.</div>;
  }

  const onSyncSernageomin = async () => {
    setSyncing(true);
    const t = toast.loading("Sincronizando con SERNAGEOMIN…");
    try {
      const { data: result, error } = await supabase.functions.invoke("sync-catastro", {
        body: { projectId: active.id },
      });
      if (error) throw error;
      const checked = result?.checked ?? 0;
      const changed = result?.changed ?? 0;
      const missing = result?.missing ?? 0;
      const alerts = result?.alertsCreated ?? 0;

      // Chain compute-overlaps so conflicts stay in sync with authoritative data
      toast.loading("Analizando sobreposiciones…", { id: t });
      let detected = 0;
      try {
        const { data: ov, error: ovErr } = await supabase.functions.invoke("compute-overlaps", {
          body: { projectId: active.id },
        });
        if (ovErr) throw ovErr;
        detected = ov?.detected ?? 0;
      } catch (ovErr) {
        // Don't fail the whole sync — overlaps are best-effort
        console.error("compute-overlaps failed", ovErr);
        toast.warning(
          `Sync OK · ${checked} revisadas · ${changed} cambios · ${alerts} alertas · sobreposiciones no recalculadas`,
          { id: t, duration: 6000 }
        );
        // Notify panels even on partial success
        window.dispatchEvent(new CustomEvent("catastro:synced", { detail: { projectId: active.id } }));
        return;
      }

      toast.success(
        `Sync OK · ${checked} revisadas · ${changed} cambios · ${missing} no encontradas · ${alerts} alertas · ${detected} sobreposiciones`,
        { id: t, duration: 7000 }
      );
      // Tell panels (overlaps, concessions, alerts) to refresh
      window.dispatchEvent(new CustomEvent("catastro:synced", { detail: { projectId: active.id } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en sync", { id: t });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Catastro minero</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {active.code} · {active.name}
          </p>
        </div>
        <button
          onClick={onSyncSernageomin}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-[11px] font-mono uppercase tracking-wider hover:bg-signal-cyan/20 disabled:opacity-50 transition-colors"
          title="Consulta el ArcGIS oficial de SERNAGEOMIN, registra snapshots y genera alertas de cambios o vencimientos."
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sincronizar con SERNAGEOMIN
        </button>
      </div>

      {/* Tab picker — mobile */}
      <MobileTabPicker tabs={TABS} value={tab} onChange={setTab} />

      {/* Tab bar — desktop */}
      <div className="hidden md:flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-signal-cyan text-signal-cyan"
                  : "border-transparent text-text-dim hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "concessions" && <ConcessionsTab />}
      {tab === "holders" && user && <HoldersTab projectId={active.id} userId={user.id} />}
      {tab === "patents" && user && <PatentCalendar projectId={active.id} userId={user.id} />}
      {tab === "overlaps" && <OverlapInspector projectId={active.id} />}
      {tab === "watches" && user && <WatchManager projectId={active.id} userId={user.id} />}
      {tab === "sync" && <SyncLog projectId={active.id} />}
    </div>
  );
}

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

function ConcessionsTab() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { data, loading, refresh } = useMiningConcessions(active?.id ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ExpiryStatus | "all">("all");
  const [editing, setEditing] = useState<MiningConcession | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<MiningConcession | null>(null);
  const [importing, setImporting] = useState(false);
  const [catastroFC, setCatastroFC] = useState<GeoJSON.FeatureCollection | null>(null);

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

  if (!active) return null;

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
    <div className="p-4 md:p-6 pb-20 md:pb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Catastro minero</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Concesiones del proyecto · {active.code} · {active.name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-sm hover:bg-signal-cyan/20"
            title="Importa concesiones reales desde el catastro oficial SERNAGEOMIN"
          >
            <Download className="w-4 h-4" /> Importar SERNAGEOMIN
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nueva concesión
          </button>
        </div>
      </div>

      {importing && active && (
        <ImportConcessionsDialog
          open={importing}
          onClose={() => setImporting(false)}
          projectId={active.id}
          onImported={refresh}
        />
      )}

      {/* Stats — mobile shows 3 critical, desktop shows all 5 */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <Stat label="Vigentes" value={String(stats.vigentes)} color="#0d9488" />
        <Stat label="<90d" value={String(stats.lt90)} color="#f59e0b" />
        <Stat label="Vencidas" value={String(stats.vencidas)} color="#dc2626" />
        <Stat label="Total" value={String(stats.total)} className="hidden md:block" />
        <Stat label="Área (ha)" value={stats.areaTotal.toFixed(1)} className="hidden md:block" />
      </div>

      {/* Mapa interactivo del catastro */}
      <CatastroMap
        concessions={data}
        projectName={`${active.code} · ${active.name}`}
        onFeaturesLoaded={setCatastroFC}
      />

      {/* Análisis de superposición SERNAGEOMIN ↔ proyecto */}
      <CatastroOverlapPanel
        catastroFeatures={(catastroFC?.features ?? []) as React.ComponentProps<typeof CatastroOverlapPanel>["catastroFeatures"]}
        projectConcessions={data}
      />

      {/* Vigilancia (alertas) + Intersección AOI ↔ catastro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ConcessionAlertsPanel projectId={active.id} />
        <AoiOverlapPanel
          aoi={{ type: "Polygon", coordinates: [PROJECT_AOI] }}
          concessions={data}
          onSelectConcession={(id) => {
            const c = data.find((x) => x.id === id);
            if (c) setViewing(c);
          }}
        />
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

      {/* List: cards on mobile, table on md+ */}
      <div className="border border-border rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-text-secondary text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            {data.length === 0 ? "Sin concesiones todavía. Crea la primera." : "Sin resultados con esos filtros."}
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {filtered.map((c) => {
                const st = expiryStatus(c.expires_at);
                const days = daysUntilExpiry(c.expires_at);
                const color = EXPIRY_COLORS[st];
                const intersects = intersectsAoiBbox(c.geometry_geojson, PROJECT_AOI);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setViewing(c)}
                    className="w-full text-left p-3 space-y-1.5 active:bg-bg-elevated transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-semibold text-sm truncate">{c.code}</div>
                        <div className="text-xs text-text-secondary truncate">{c.name}</div>
                      </div>
                      <span className="shrink-0 text-text-dim text-[10px] font-mono uppercase tracking-wider">Ver →</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                      <div><span className="text-text-secondary">Titular:</span> {c.holder ?? "—"}</div>
                      <div><span className="text-text-secondary">Tipo:</span> {TYPE_LABELS[c.concession_type] ?? c.concession_type}</div>
                      <div><span className="text-text-secondary">Estado:</span> {STATUS_LABELS[c.status] ?? c.status}</div>
                      <div><span className="text-text-secondary">Área:</span> {c.area_ha ?? "—"} ha</div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span style={{ color }} className="font-medium">
                        {c.expires_at ?? "Sin vencimiento"}
                        {days !== null && (
                          <span className="ml-1 opacity-80">
                            ({days < 0 ? `${Math.abs(days)}d vencida` : `${days}d`})
                          </span>
                        )}
                      </span>
                      {intersects && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <MapPin className="w-3 h-3" /> AOI
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
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
                    <Th> </Th>
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
                            <button onClick={() => setEditing(c)} className="p-1 rounded hover:bg-accent" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onDelete(c)} className="p-1 rounded hover:bg-destructive/20 text-destructive" title="Eliminar">
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
          </>
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

      {viewing && (
        <ConcessionDetailDrawer
          concession={viewing}
          intersectsAoi={intersectsAoiBbox(viewing.geometry_geojson, PROJECT_AOI)}
          allConcessions={data}
          onJumpTo={(c) => setViewing(c)}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onDelete={async () => { const c = viewing; setViewing(null); await onDelete(c); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color, className }: { label: string; value: string; color?: string; className?: string }) {
  return (
    <div className={cn("border border-border rounded p-2.5 bg-bg-secondary/30", className)}>
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
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar concesión" : "Nueva concesión"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div className="md:col-span-2">
            <Field label="Notas">
              <textarea rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
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
