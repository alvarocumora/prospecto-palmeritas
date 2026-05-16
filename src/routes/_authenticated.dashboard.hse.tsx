import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canAccess } from "@/hooks/useProjectRole";
import {
  useHse,
  PERMIT_TYPES,
  PERMIT_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_CATEGORY,
  INCIDENT_STATUS,
  COMMUNITY_EVENT_TYPES,
  COMMUNITY_EVENT_STATUS,
  type PermitType,
  type PermitStatus,
  type IncidentSeverity,
  type IncidentCategory,
  type IncidentStatus,
  type CommunityEventType,
  type CommunityEventStatus,
} from "@/hooks/useHse";
import { ShieldAlert, AlertTriangle, Users, Plus, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/hse")({
  component: HsePage,
});

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-gold/15 text-gold",
  critical: "bg-destructive/15 text-destructive",
  near_miss: "bg-teal/15 text-teal",
};

function HsePage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const projectId = active?.id ?? null;
  const allowed = canAccess(role, "hse");
  const {
    permits,
    incidents,
    events,
    loading,
    addPermit,
    addIncident,
    addEvent,
    updateIncidentStatus,
    expiringPermits,
    expiredPermits,
    openIncidents,
  } = useHse(projectId);

  const [tab, setTab] = useState<"permits" | "incidents" | "community">("permits");
  const [showForm, setShowForm] = useState(false);

  if (!projectId) {
    return <div className="p-6 text-sm text-muted-foreground">Selecciona un proyecto.</div>;
  }
  if (!allowed) {
    return <div className="p-6 text-sm text-muted-foreground">No tienes acceso al módulo HSE.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-gold" /> HSE & Cumplimiento
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Permisos, incidentes y relación comunitaria
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Permisos activos"
          value={permits.filter((p) => p.status === "active").length}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <KpiCard
          label="Por vencer (≤90d)"
          value={expiringPermits.length}
          tone={expiringPermits.length > 0 ? "warn" : "ok"}
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiCard
          label="Incidentes abiertos"
          value={openIncidents.length}
          tone={openIncidents.length > 0 ? "alert" : "ok"}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <KpiCard
          label="Eventos comunitarios"
          value={events.length}
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["permits", "incidents", "community"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setShowForm(false);
            }}
            className={`px-3 py-2 text-xs font-mono uppercase transition-colors ${
              tab === t
                ? "text-gold border-b-2 border-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "permits" ? "Permisos" : t === "incidents" ? "Incidentes" : "Comunidad"}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gold text-bg-secondary text-xs font-mono hover:bg-gold/90"
          >
            <Plus className="w-3 h-3" /> Nuevo
          </button>
        </div>
      </div>

      {loading && <div className="text-xs text-muted-foreground font-mono">Cargando…</div>}

      {tab === "permits" && (
        <>
          {showForm && (
            <PermitForm
              onSubmit={async (d) => {
                await addPermit(d);
                setShowForm(false);
              }}
            />
          )}
          <PermitsTable permits={permits} expiring={expiringPermits} expired={expiredPermits} />
        </>
      )}
      {tab === "incidents" && (
        <>
          {showForm && (
            <IncidentForm
              onSubmit={async (d) => {
                await addIncident(d);
                setShowForm(false);
              }}
            />
          )}
          <IncidentsTable incidents={incidents} onStatusChange={updateIncidentStatus} />
        </>
      )}
      {tab === "community" && (
        <>
          {showForm && (
            <EventForm
              onSubmit={async (d) => {
                await addEvent(d);
                setShowForm(false);
              }}
            />
          )}
          <EventsTable events={events} />
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "ok",
  icon,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "alert";
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === "alert"
      ? "border-destructive/30 text-destructive"
      : tone === "warn"
        ? "border-gold/30 text-gold"
        : "border-border text-foreground";
  return (
    <div className={`p-3 rounded border ${toneCls} bg-bg-secondary`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-mono font-bold mt-1">{value}</div>
    </div>
  );
}

/* ============= PERMITS ============= */

function PermitsTable({
  permits,
  expiring,
  expired,
}: {
  permits: ReturnType<typeof useHse>["permits"];
  expiring: ReturnType<typeof useHse>["expiringPermits"];
  expired: ReturnType<typeof useHse>["expiredPermits"];
}) {
  const expSet = new Set(expiring.map((p) => p.id));
  const expdSet = new Set(expired.map((p) => p.id));
  if (permits.length === 0)
    return (
      <div className="text-xs text-muted-foreground font-mono p-4">Sin permisos registrados.</div>
    );
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Tipo</th>
            <th className="px-2 py-2 text-left">Título</th>
            <th className="px-2 py-2 text-left">Autoridad</th>
            <th className="px-2 py-2 text-left">N°</th>
            <th className="px-2 py-2 text-left">Vence</th>
            <th className="px-2 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {permits.map((p) => (
            <tr
              key={p.id}
              className={`border-t border-border ${expdSet.has(p.id) ? "bg-destructive/5" : expSet.has(p.id) ? "bg-gold/5" : ""}`}
            >
              <td className="px-2 py-2">{p.permit_type}</td>
              <td className="px-2 py-2">{p.title}</td>
              <td className="px-2 py-2">{p.authority ?? "—"}</td>
              <td className="px-2 py-2">{p.number ?? "—"}</td>
              <td className="px-2 py-2">
                {p.expires_at ?? "—"}{" "}
                {expdSet.has(p.id) && <span className="text-destructive">⚠</span>}
                {expSet.has(p.id) && !expdSet.has(p.id) && <span className="text-gold">⏱</span>}
              </td>
              <td className="px-2 py-2 uppercase text-[10px]">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermitForm({
  onSubmit,
}: {
  onSubmit: (d: {
    permit_type: PermitType;
    authority: string | null;
    number: string | null;
    title: string;
    issued_at: string | null;
    expires_at: string | null;
    status: PermitStatus;
    document_url: string | null;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [permit_type, setType] = useState<PermitType>("environmental");
  const [title, setTitle] = useState("");
  const [authority, setAuth] = useState("");
  const [number, setNumber] = useState("");
  const [issued_at, setIss] = useState("");
  const [expires_at, setExp] = useState("");
  const [status, setStatus] = useState<PermitStatus>("active");
  const [notes, setNotes] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title) return;
        await onSubmit({
          permit_type,
          title,
          authority: authority || null,
          number: number || null,
          issued_at: issued_at || null,
          expires_at: expires_at || null,
          status,
          document_url: null,
          notes: notes || null,
        });
      }}
      className="p-4 rounded border border-border bg-bg-secondary grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono"
    >
      <select
        value={permit_type}
        onChange={(e) => setType(e.target.value as PermitType)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {PERMIT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título *"
        className="px-2 py-1.5 rounded border border-border bg-background"
        required
      />
      <input
        value={authority}
        onChange={(e) => setAuth(e.target.value)}
        placeholder="Autoridad"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="N° permiso"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <input
        type="date"
        value={issued_at}
        onChange={(e) => setIss(e.target.value)}
        placeholder="Emitido"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <input
        type="date"
        value={expires_at}
        onChange={(e) => setExp(e.target.value)}
        placeholder="Vence"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as PermitStatus)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {PERMIT_STATUS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas"
        className="px-2 py-1.5 rounded border border-border bg-background md:col-span-2"
      />
      <button
        type="submit"
        className="md:col-span-3 px-3 py-1.5 rounded bg-gold text-bg-secondary hover:bg-gold/90"
      >
        Guardar permiso
      </button>
    </form>
  );
}

/* ============= INCIDENTS ============= */

function IncidentsTable({
  incidents,
  onStatusChange,
}: {
  incidents: ReturnType<typeof useHse>["incidents"];
  onStatusChange: (id: string, s: IncidentStatus) => Promise<{ error: string | null }>;
}) {
  if (incidents.length === 0)
    return (
      <div className="text-xs text-muted-foreground font-mono p-4">Sin incidentes registrados.</div>
    );
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Fecha</th>
            <th className="px-2 py-2 text-left">Severidad</th>
            <th className="px-2 py-2 text-left">Categoría</th>
            <th className="px-2 py-2 text-left">Descripción</th>
            <th className="px-2 py-2 text-left">Afectados</th>
            <th className="px-2 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} className="border-t border-border">
              <td className="px-2 py-2">{new Date(i.occurred_at).toLocaleDateString("es-CL")}</td>
              <td className="px-2 py-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${SEVERITY_COLORS[i.severity]}`}
                >
                  {i.severity}
                </span>
              </td>
              <td className="px-2 py-2">{i.category}</td>
              <td className="px-2 py-2 max-w-md truncate">{i.description}</td>
              <td className="px-2 py-2 text-center">{i.people_affected}</td>
              <td className="px-2 py-2">
                <select
                  value={i.status}
                  onChange={(e) => onStatusChange(i.id, e.target.value as IncidentStatus)}
                  className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px] uppercase"
                >
                  {INCIDENT_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncidentForm({
  onSubmit,
}: {
  onSubmit: (d: {
    occurred_at: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    location: string | null;
    description: string;
    people_affected: number;
    corrective_actions: string | null;
    status: IncidentStatus;
    closed_at: string | null;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [occurred_at, setOcc] = useState(new Date().toISOString().slice(0, 16));
  const [severity, setSev] = useState<IncidentSeverity>("low");
  const [category, setCat] = useState<IncidentCategory>("safety");
  const [description, setDesc] = useState("");
  const [people_affected, setPpl] = useState(0);
  const [location, setLoc] = useState("");
  const [corrective, setCorr] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description) return;
        await onSubmit({
          occurred_at: new Date(occurred_at).toISOString(),
          severity,
          category,
          location: location || null,
          description,
          people_affected,
          corrective_actions: corrective || null,
          status: "open",
          closed_at: null,
          notes: null,
        });
      }}
      className="p-4 rounded border border-border bg-bg-secondary grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono"
    >
      <input
        type="datetime-local"
        value={occurred_at}
        onChange={(e) => setOcc(e.target.value)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <select
        value={severity}
        onChange={(e) => setSev(e.target.value as IncidentSeverity)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {INCIDENT_SEVERITY.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={category}
        onChange={(e) => setCat(e.target.value as IncidentCategory)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {INCIDENT_CATEGORY.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        value={location}
        onChange={(e) => setLoc(e.target.value)}
        placeholder="Ubicación"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <input
        type="number"
        value={people_affected}
        onChange={(e) => setPpl(Number(e.target.value))}
        placeholder="Personas afectadas"
        className="px-2 py-1.5 rounded border border-border bg-background"
        min={0}
      />
      <textarea
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descripción *"
        className="md:col-span-3 px-2 py-1.5 rounded border border-border bg-background"
        rows={2}
        required
      />
      <textarea
        value={corrective}
        onChange={(e) => setCorr(e.target.value)}
        placeholder="Acciones correctivas"
        className="md:col-span-3 px-2 py-1.5 rounded border border-border bg-background"
        rows={2}
      />
      <button
        type="submit"
        className="md:col-span-3 px-3 py-1.5 rounded bg-gold text-bg-secondary hover:bg-gold/90"
      >
        Registrar incidente
      </button>
    </form>
  );
}

/* ============= COMMUNITY ============= */

function EventsTable({ events }: { events: ReturnType<typeof useHse>["events"] }) {
  if (events.length === 0)
    return (
      <div className="text-xs text-muted-foreground font-mono p-4">
        Sin eventos comunitarios registrados.
      </div>
    );
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Fecha</th>
            <th className="px-2 py-2 text-left">Tipo</th>
            <th className="px-2 py-2 text-left">Comunidad</th>
            <th className="px-2 py-2 text-left">Asistentes</th>
            <th className="px-2 py-2 text-left">Resumen</th>
            <th className="px-2 py-2 text-left">Seguimiento</th>
            <th className="px-2 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="px-2 py-2">{e.event_date}</td>
              <td className="px-2 py-2">{e.event_type}</td>
              <td className="px-2 py-2">{e.community_name}</td>
              <td className="px-2 py-2 text-center">{e.attendees ?? "—"}</td>
              <td className="px-2 py-2 max-w-md truncate">{e.summary}</td>
              <td className="px-2 py-2">{e.follow_up_date ?? "—"}</td>
              <td className="px-2 py-2 uppercase text-[10px]">{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventForm({
  onSubmit,
}: {
  onSubmit: (d: {
    event_type: CommunityEventType;
    community_name: string;
    event_date: string;
    attendees: number | null;
    summary: string;
    commitments: string | null;
    follow_up_date: string | null;
    status: CommunityEventStatus;
  }) => Promise<void>;
}) {
  const [event_type, setT] = useState<CommunityEventType>("meeting");
  const [community_name, setCom] = useState("");
  const [event_date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAtt] = useState<number | "">("");
  const [summary, setSum] = useState("");
  const [commitments, setComm] = useState("");
  const [follow_up_date, setFup] = useState("");
  const [status, setS] = useState<CommunityEventStatus>("completed");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!community_name || !summary) return;
        await onSubmit({
          event_type,
          community_name,
          event_date,
          attendees: attendees === "" ? null : Number(attendees),
          summary,
          commitments: commitments || null,
          follow_up_date: follow_up_date || null,
          status,
        });
      }}
      className="p-4 rounded border border-border bg-bg-secondary grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono"
    >
      <select
        value={event_type}
        onChange={(e) => setT(e.target.value as CommunityEventType)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {COMMUNITY_EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        value={community_name}
        onChange={(e) => setCom(e.target.value)}
        placeholder="Comunidad *"
        className="px-2 py-1.5 rounded border border-border bg-background"
        required
      />
      <input
        type="date"
        value={event_date}
        onChange={(e) => setDate(e.target.value)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <input
        type="number"
        value={attendees}
        onChange={(e) => setAtt(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="Asistentes"
        className="px-2 py-1.5 rounded border border-border bg-background"
        min={0}
      />
      <input
        type="date"
        value={follow_up_date}
        onChange={(e) => setFup(e.target.value)}
        placeholder="Seguimiento"
        className="px-2 py-1.5 rounded border border-border bg-background"
      />
      <select
        value={status}
        onChange={(e) => setS(e.target.value as CommunityEventStatus)}
        className="px-2 py-1.5 rounded border border-border bg-background"
      >
        {COMMUNITY_EVENT_STATUS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <textarea
        value={summary}
        onChange={(e) => setSum(e.target.value)}
        placeholder="Resumen *"
        className="md:col-span-3 px-2 py-1.5 rounded border border-border bg-background"
        rows={2}
        required
      />
      <textarea
        value={commitments}
        onChange={(e) => setComm(e.target.value)}
        placeholder="Compromisos"
        className="md:col-span-3 px-2 py-1.5 rounded border border-border bg-background"
        rows={2}
      />
      <button
        type="submit"
        className="md:col-span-3 px-3 py-1.5 rounded bg-gold text-bg-secondary hover:bg-gold/90"
      >
        Registrar evento
      </button>
    </form>
  );
}
