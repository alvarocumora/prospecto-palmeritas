import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Gavel,
  FileDown,
} from "lucide-react";
import { generateHolderProfilePdf } from "@/lib/pdf/holder-profile";
import { LegalAlertsFeed } from "@/components/ops/LegalAlertsFeed";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import {
  useMiningBulletins,
  useBulletinAlerts,
  useWatchHolders,
  triggerBoletinSync,
  useCourtCases,
  useCourtCaseAlerts,
  triggerPjudSync,
  type MiningBulletin,
  type CourtCase,
} from "@/hooks/useMiningBulletins";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/boletin")({
  head: () => ({ meta: [{ title: "Boletín Oficial Minero — Geocapitals" }] }),
  component: BoletinModule,
});

const TYPE_COLORS: Record<string, string> = {
  pedimento: "#0d9488",
  mensura: "#f59e0b",
  manifestacion: "#8b5cf6",
  otro: "#6b7280",
};

function BoletinModule() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { data: bulletins, loading, refresh } = useMiningBulletins(150);
  const { data: alerts, refresh: refreshAlerts, markRead } = useBulletinAlerts(active?.id ?? null);
  const { data: watchHolders, refresh: refreshHolders } = useWatchHolders(active?.id ?? null);
  const { data: courtCases, refresh: refreshCases } = useCourtCases(150);
  const {
    data: courtAlerts,
    refresh: refreshCourtAlerts,
    markRead: markCourtRead,
  } = useCourtCaseAlerts(active?.id ?? null);
  const [syncing, setSyncing] = useState(false);
  const [syncingPjud, setSyncingPjud] = useState(false);
  const [tab, setTab] = useState<"legal" | "alerts" | "all" | "pjud" | "watch">("legal");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const onSync = async () => {
    setSyncing(true);
    toast.loading("Sincronizando con boletinminero.cl…", { id: "sync" });
    const result = await triggerBoletinSync();
    toast.dismiss("sync");
    if (result.success) {
      toast.success(
        `${result.inserted ?? 0} nuevas · ${result.skipped ?? 0} ya conocidas · ${result.alertsCreated ?? 0} alertas`,
      );
      refresh();
      refreshAlerts();
    } else {
      toast.error(result.error ?? "Error en la sincronización");
    }
    setSyncing(false);
  };

  const onSyncPjud = async () => {
    setSyncingPjud(true);
    toast.loading("Sincronizando PJUD…", { id: "sync-pjud" });
    const result = await triggerPjudSync();
    toast.dismiss("sync-pjud");
    if (result.success) {
      toast.success(`PJUD: ${result.inserted ?? 0} nuevas · ${result.alertsCreated ?? 0} alertas`);
      refreshCases();
      refreshCourtAlerts();
    } else {
      toast.error(result.error ?? "Error PJUD");
    }
    setSyncingPjud(false);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return bulletins.filter((b) => {
      if (filterType !== "all" && b.publication_type !== filterType) return false;
      if (!s) return true;
      return (
        (b.holder_name ?? "").toLowerCase().includes(s) ||
        (b.holder_rut ?? "").toLowerCase().includes(s) ||
        (b.concession_name ?? "").toLowerCase().includes(s) ||
        (b.comuna ?? "").toLowerCase().includes(s)
      );
    });
  }, [bulletins, search, filterType]);

  const unreadAlerts = alerts.filter((a) => !a.is_read);
  const unreadCourt = courtAlerts.filter((a) => !a.is_read);
  const unreadLegal = unreadAlerts.length + unreadCourt.length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Boletín Oficial de Minería</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Pedimentos, mensuras y manifestaciones publicadas en boletinminero.cl
            {active && (
              <>
                {" "}
                · Vigilancia activa para <strong>{active.code}</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSyncPjud}
            disabled={syncingPjud}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm hover:bg-accent disabled:opacity-50"
          >
            <Gavel className={`w-4 h-4 ${syncingPjud ? "animate-pulse" : ""}`} />
            {syncingPjud ? "PJUD…" : "Sync PJUD"}
          </button>
          <button
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sync Boletín"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Publicaciones totales" value={String(bulletins.length)} />
        <Stat
          label="Alertas no leídas"
          value={String(unreadAlerts.length)}
          color={unreadAlerts.length > 0 ? "#dc2626" : undefined}
        />
        <Stat label="Titulares vigilados" value={String(watchHolders.length)} />
        <Stat
          label="Última sync"
          value={
            bulletins[0]?.scraped_at
              ? new Date(bulletins[0].scraped_at).toLocaleDateString("es-CL")
              : "—"
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        <TabButton active={tab === "legal"} onClick={() => setTab("legal")}>
          Alertas legales{" "}
          {unreadLegal > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px]">
              {unreadLegal}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alertas Boletín{" "}
          {unreadAlerts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px]">
              {unreadAlerts.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "pjud"} onClick={() => setTab("pjud")}>
          PJUD{" "}
          {courtAlerts.filter((a) => !a.is_read).length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px]">
              {courtAlerts.filter((a) => !a.is_read).length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          Todas las publicaciones
        </TabButton>
        <TabButton active={tab === "watch"} onClick={() => setTab("watch")}>
          Titulares vigilados
        </TabButton>
      </div>

      {tab === "legal" && (
        <LegalAlertsFeed
          bulletinAlerts={alerts}
          courtAlerts={courtAlerts}
          onMarkBulletinRead={markRead}
          onMarkCourtRead={markCourtRead}
          hasProject={!!active}
        />
      )}

      {tab === "pjud" && (
        <div className="space-y-2">
          <div className="text-xs text-text-secondary">
            Causas judiciales mineras del Poder Judicial · {courtCases.length} causas en BD ·{" "}
            {courtAlerts.length} alertas para este proyecto
          </div>
          {!active ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              Selecciona un proyecto para ver alertas PJUD.
            </div>
          ) : courtAlerts.length === 0 && courtCases.length === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              Sin causas todavía. Pulsa "Sync PJUD" para extraer causas mineras del Poder Judicial.
            </div>
          ) : (
            <>
              {courtAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`border rounded p-3 ${a.is_read ? "border-border bg-bg-secondary/30" : "border-amber-500/40 bg-amber-500/10"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!a.is_read && <Gavel className="w-4 h-4 text-amber-600 shrink-0" />}
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-secondary border border-border">
                          {a.match_type === "defendant_rut" ? "RUT demandado" : "Demandado"}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {new Date(a.created_at).toLocaleString("es-CL")}
                        </span>
                      </div>
                      {a.case && <CourtCaseSummary c={a.case} />}
                      {a.match_detail && (
                        <div className="text-[11px] text-text-secondary mt-1">
                          Coincidencia: {a.match_detail}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => markCourtRead(a.id)}
                      className="p-1.5 rounded hover:bg-accent shrink-0"
                    >
                      {a.is_read ? (
                        <EyeOff className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {courtCases.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                    Todas las causas mineras
                  </div>
                  <div className="border border-border rounded divide-y divide-border">
                    {courtCases.slice(0, 30).map((c) => (
                      <div key={c.id} className="p-3 hover:bg-accent/30">
                        <CourtCaseSummary c={c} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-2">
          {!active ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              Selecciona un proyecto para ver alertas.
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-center text-text-secondary text-sm">
              Sin alertas todavía. Agrega titulares vigilados o asegúrate de tener un AOI definido
              en una campaña.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`border rounded p-3 ${a.is_read ? "border-border bg-bg-secondary/30" : "border-amber-500/40 bg-amber-500/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!a.is_read && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-secondary border border-border">
                        {a.match_type === "aoi"
                          ? "AOI"
                          : a.match_type === "holder_rut"
                            ? "RUT"
                            : "Titular"}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {new Date(a.created_at).toLocaleString("es-CL")}
                      </span>
                    </div>
                    {a.bulletin && <BulletinSummary b={a.bulletin} />}
                    {a.match_detail && (
                      <div className="text-[11px] text-text-secondary mt-1">
                        Coincidencia: {a.match_detail}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => markRead(a.id)}
                    className="p-1.5 rounded hover:bg-accent shrink-0"
                    title={a.is_read ? "Leída" : "Marcar leída"}
                  >
                    {a.is_read ? (
                      <EyeOff className="w-4 h-4 text-text-secondary" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "all" && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar titular, RUT, concesión o comuna…"
              className="flex-1 min-w-[200px] px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-1">
              {(["all", "pedimento", "mensura", "manifestacion", "otro"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    filterType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-bg-secondary border-border hover:bg-accent"
                  }`}
                >
                  {t === "all" ? "Todos" : t}
                </button>
              ))}
            </div>
          </div>
          <div className="border border-border rounded overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-text-secondary text-sm">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                {bulletins.length === 0
                  ? 'Sin publicaciones todavía. Pulsa "Sincronizar ahora" para extraer del Boletín.'
                  : "Sin resultados con esos filtros."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((b) => (
                  <div key={b.id} className="p-3 hover:bg-accent/30">
                    <BulletinSummary b={b} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "watch" && active && user && (
        <WatchHoldersPanel
          projectId={active.id}
          projectName={active.name}
          userId={user.id}
          holders={watchHolders}
          onChange={refreshHolders}
        />
      )}
      {tab === "watch" && !active && (
        <div className="p-6 text-center text-text-secondary text-sm">Selecciona un proyecto.</div>
      )}
    </div>
  );
}

function CourtCaseSummary({ c }: { c: CourtCase }) {
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-bg-secondary border border-border">
          {c.matter ?? "causa minera"}
        </span>
        {c.case_number && <span className="font-mono text-text-secondary">{c.case_number}</span>}
        {c.filed_at && <span className="text-text-secondary">{c.filed_at}</span>}
        {c.source_url && (
          <a
            href={c.source_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-primary hover:underline inline-flex items-center gap-0.5"
          >
            PJUD <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="mt-1 text-sm font-medium">{c.defendant ?? "Sin demandado"}</div>
      <div className="text-xs text-text-secondary mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {c.court && <span>⚖️ {c.court}</span>}
        {c.defendant_rut && <span className="font-mono">RUT {c.defendant_rut}</span>}
        {c.comuna && (
          <span>
            📍 {c.comuna}
            {c.region && `, ${c.region}`}
          </span>
        )}
        {c.status && <span>· {c.status}</span>}
      </div>
    </div>
  );
}

function BulletinSummary({ b }: { b: MiningBulletin }) {
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
          style={{
            backgroundColor: `${TYPE_COLORS[b.publication_type] ?? "#6b7280"}20`,
            color: TYPE_COLORS[b.publication_type] ?? "#6b7280",
          }}
        >
          {b.publication_type}
        </span>
        {b.publication_number && (
          <span className="font-mono text-text-secondary">#{b.publication_number}</span>
        )}
        {b.publication_date && <span className="text-text-secondary">{b.publication_date}</span>}
        {b.source_url && (
          <a
            href={b.source_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Fuente <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="mt-1 text-sm font-medium">
        {b.concession_name ?? "Concesión sin nombre"}
        {b.concession_code && (
          <span className="text-text-secondary ml-1.5 font-mono text-xs">
            ({b.concession_code})
          </span>
        )}
      </div>
      <div className="text-xs text-text-secondary mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {b.holder_name && (
          <span>
            👤 {b.holder_name}
            {b.holder_rut && <span className="ml-1 font-mono">· {b.holder_rut}</span>}
          </span>
        )}
        {b.comuna && (
          <span>
            📍 {b.comuna}
            {b.region && <span>, {b.region}</span>}
          </span>
        )}
        {b.area_ha && <span>{b.area_ha} ha</span>}
      </div>
    </div>
  );
}

function WatchHoldersPanel({
  projectId,
  projectName,
  userId,
  holders,
  onChange,
}: {
  projectId: string;
  projectName: string;
  userId: string;
  holders: ReturnType<typeof useWatchHolders>["data"];
  onChange: () => void;
}) {
  const [form, setForm] = useState({ holder_name: "", holder_rut: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const onExportPdf = async (h: {
    id: string;
    holder_name: string | null;
    holder_rut: string | null;
  }) => {
    setExporting(h.id);
    try {
      const res = await generateHolderProfilePdf({
        projectId,
        projectName,
        holderName: h.holder_name,
        holderRut: h.holder_rut,
      });
      toast.success(`Perfil generado: ${res.publications} publicaciones, ${res.cases} causas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando PDF");
    } finally {
      setExporting(null);
    }
  };

  const onAdd = async () => {
    if (!form.holder_name.trim() && !form.holder_rut.trim()) {
      toast.error("Indica al menos un nombre o un RUT");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("bulletin_watch_holders").insert({
      project_id: projectId,
      created_by: userId,
      holder_name: form.holder_name.trim() || null,
      holder_rut: form.holder_rut.trim() || null,
      notes: form.notes.trim() || null,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Titular agregado a vigilancia");
      setForm({ holder_name: "", holder_rut: "", notes: "" });
      onChange();
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar este titular vigilado?")) return;
    const { error } = await supabase.from("bulletin_watch_holders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Eliminado");
      onChange();
    }
  };

  return (
    <div className="space-y-3">
      <div className="border border-border rounded p-3 bg-bg-secondary/30">
        <div className="text-xs font-medium mb-2">Agregar titular a vigilancia</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            placeholder="Nombre del titular"
            value={form.holder_name}
            onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
            className="px-2 py-1.5 text-sm bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            placeholder="RUT (12345678-9)"
            value={form.holder_rut}
            onChange={(e) => setForm({ ...form, holder_rut: e.target.value })}
            className="px-2 py-1.5 text-sm bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <input
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="px-2 py-1.5 text-sm bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={onAdd}
          disabled={adding}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden">
        {holders.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            Sin titulares vigilados todavía.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-bg-secondary border-b border-border text-left">
              <tr>
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  Nombre
                </th>
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  RUT
                </th>
                <th className="px-2.5 py-1.5 font-medium text-text-secondary uppercase tracking-wider text-[10px]">
                  Notas
                </th>
                <th className="px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="px-2.5 py-1.5">{h.holder_name ?? "—"}</td>
                  <td className="px-2.5 py-1.5 font-mono">{h.holder_rut ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-text-secondary">{h.notes ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => onExportPdf(h)}
                        disabled={exporting === h.id}
                        className="p-1 rounded hover:bg-accent text-text-secondary hover:text-foreground disabled:opacity-50"
                        title="Generar perfil PDF"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(h.id)}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded p-2.5 bg-bg-secondary/30">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-lg font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-text-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
