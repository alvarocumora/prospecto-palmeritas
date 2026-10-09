import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Activity,
  Download,
  Radio,
  Upload,
  AlertTriangle,
} from "lucide-react";
import {
  useSurvey,
  useGeophysicsMutations,
  type Station,
  type Line,
} from "@/hooks/useGeophysicsCRUD";
import { useGeophysicsAnomalies } from "@/hooks/useGeophysicsAnomalies";
import { useProjects } from "@/hooks/useProjects";
import { StationCsvImport } from "@/components/geophysics/StationCsvImport";
import { AnomaliesTab } from "@/components/geophysics/AnomaliesTab";
import {
  WorkflowStepper,
  PHASE_ORDER,
  phaseFromStatus,
  type WorkflowPhase,
  type PhaseProgress,
} from "@/components/geophysics/WorkflowStepper";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/geophysics/$surveyId")({
  head: () => ({ meta: [{ title: "Detalle campaña — Geocapitals" }] }),
  component: SurveyDetail,
});

function SurveyDetail() {
  const { surveyId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { active } = useProjects();
  const { survey, lines, stations, loading, refresh } = useSurvey(surveyId);
  const { updateSurvey } = useGeophysicsMutations();
  const { data: anomalies, refresh: refreshAnomalies } = useGeophysicsAnomalies(surveyId);
  const [tab, setTab] = useState<"stations" | "lines" | "anomalies">("stations");
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [creatingStation, setCreatingStation] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [creatingLine, setCreatingLine] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [phaseBusy, setPhaseBusy] = useState(false);

  if (location.pathname.endsWith("/field")) return <Outlet />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Campaña no encontrada.</p>
        <button
          onClick={() => navigate({ to: "/dashboard/geophysics" })}
          className="mt-3 text-xs text-gold hover:underline"
        >
          Volver
        </button>
      </div>
    );
  }

  if (!active || survey.project_id !== active.id) {
    return <div className="p-6 text-sm">La campaña no pertenece al proyecto seleccionado.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <div className="flex items-center justify-between mb-3 gap-2">
        <Link
          to="/projects/$projectId/$section"
          params={{ projectId: active.id, section: "exploration" }}
          search={{ project: undefined }}
          className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="w-3 h-3" /> Volver a campañas
        </Link>
        <Link
          to="/dashboard/geophysics/$surveyId/field"
          search={{ project: active.id }}
          params={{ surveyId: survey.id }}
          className="inline-flex items-center gap-1.5 text-xs font-mono bg-gold text-background px-3 py-1.5 rounded hover:opacity-90"
        >
          <Radio className="w-3 h-3" /> Modo terreno
        </Link>
      </div>

      <header className="mb-6">
        <div className="text-[10px] uppercase font-mono text-muted-foreground">{survey.method}</div>
        <h1 className="text-2xl font-bold mt-1">{survey.name}</h1>
        {survey.notes && <p className="text-sm text-muted-foreground mt-2">{survey.notes}</p>}
      </header>

      {/* Workflow stepper */}
      {(() => {
        const phase = phaseFromStatus(survey.status);
        const validatedAnoms = anomalies.filter((a) => a.status === "validated").length;
        const promotedAnoms = anomalies.filter((a) => a.status === "promoted").length;
        const totalAnoms = anomalies.length;
        const progress: PhaseProgress =
          phase === "planned"
            ? {
                pct: lines.length > 0 ? 1 : 0,
                detail: `${lines.length} línea${lines.length === 1 ? "" : "s"} definida${lines.length === 1 ? "" : "s"}`,
                canAdvance: lines.length > 0,
              }
            : phase === "field"
              ? (() => {
                  const target = Math.max(
                    1,
                    survey.station_spacing_m && survey.planned_km
                      ? Math.round((survey.planned_km * 1000) / survey.station_spacing_m)
                      : Math.max(stations.length, 10),
                  );
                  const realStations = stations.filter((s) => !s.is_synthetic).length;
                  return {
                    pct: Math.min(1, realStations / target),
                    detail: `${realStations} / ${target} estaciones capturadas`,
                    canAdvance: realStations >= Math.min(target, 5),
                  };
                })()
              : phase === "processing"
                ? {
                    pct:
                      totalAnoms === 0 ? 0 : Math.min(1, validatedAnoms / Math.max(1, totalAnoms)),
                    detail: `${validatedAnoms} validada${validatedAnoms === 1 ? "" : "s"} de ${totalAnoms} anomalía${totalAnoms === 1 ? "" : "s"}`,
                    canAdvance: validatedAnoms > 0,
                  }
                : {
                    pct: 1,
                    detail: `${promotedAnoms} target${promotedAnoms === 1 ? "" : "s"} generado${promotedAnoms === 1 ? "" : "s"}`,
                    canAdvance: false,
                  };

        const advance = async () => {
          const i = PHASE_ORDER.indexOf(phase);
          const nxt = PHASE_ORDER[i + 1];
          if (!nxt) return;
          setPhaseBusy(true);
          try {
            await updateSurvey(survey.id, { status: nxt });
            toast.success(`Fase actualizada a ${nxt}`);
            refresh();
            if (nxt === "processing") setTab("anomalies");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          } finally {
            setPhaseBusy(false);
          }
        };
        const revert = async () => {
          const i = PHASE_ORDER.indexOf(phase);
          const prv = PHASE_ORDER[i - 1];
          if (!prv) return;
          setPhaseBusy(true);
          try {
            await updateSurvey(survey.id, { status: prv });
            toast.success(`Fase revertida a ${prv}`);
            refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          } finally {
            setPhaseBusy(false);
          }
        };
        const jumpTo = async (p: WorkflowPhase) => {
          if (p === phase) return;
          setPhaseBusy(true);
          try {
            await updateSurvey(survey.id, { status: p });
            toast.success(`Fase: ${p}`);
            refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          } finally {
            setPhaseBusy(false);
          }
        };

        return (
          <div className="mb-6">
            <WorkflowStepper
              phase={phase}
              progress={progress}
              busy={phaseBusy}
              onAdvance={advance}
              onRevert={revert}
              onJumpTo={jumpTo}
            />
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Estado" value={survey.status} />
        <Stat label="Estaciones" value={stations.length.toString()} />
        <Stat label="Líneas" value={lines.length.toString()} />
        <Stat label="Anomalías" value={anomalies.length.toString()} />
        <Stat
          label="Promovidas"
          value={anomalies.filter((a) => a.status === "promoted").length.toString()}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        <TabBtn
          active={tab === "stations"}
          onClick={() => setTab("stations")}
          icon={<MapPin className="w-3 h-3" />}
          label={`Estaciones (${stations.length})`}
        />
        <TabBtn
          active={tab === "lines"}
          onClick={() => setTab("lines")}
          icon={<Activity className="w-3 h-3" />}
          label={`Líneas (${lines.length})`}
        />
        <TabBtn
          active={tab === "anomalies"}
          onClick={() => setTab("anomalies")}
          icon={<AlertTriangle className="w-3 h-3" />}
          label={`Anomalías (${anomalies.length})`}
        />
      </div>

      {tab === "stations" && (
        <StationsTab
          stations={stations}
          onCreate={() => setCreatingStation(true)}
          onImport={() => setImportingCsv(true)}
          onEdit={(s) => setEditingStation(s)}
          onDeleted={refresh}
        />
      )}
      {tab === "lines" && (
        <LinesTab
          lines={lines}
          onCreate={() => setCreatingLine(true)}
          onEdit={(l) => setEditingLine(l)}
          onDeleted={refresh}
        />
      )}
      {tab === "anomalies" && active && (
        <AnomaliesTab
          projectId={active.id}
          surveyId={survey.id}
          stations={stations}
          onChanged={refreshAnomalies}
        />
      )}

      {(creatingStation || editingStation) && active && (
        <StationDialog
          projectId={active.id}
          surveyId={survey.id}
          initial={editingStation}
          onClose={() => {
            setCreatingStation(false);
            setEditingStation(null);
          }}
          onSaved={() => {
            setCreatingStation(false);
            setEditingStation(null);
            refresh();
          }}
        />
      )}
      {(creatingLine || editingLine) && active && (
        <LineDialog
          projectId={active.id}
          surveyId={survey.id}
          initial={editingLine}
          onClose={() => {
            setCreatingLine(false);
            setEditingLine(null);
          }}
          onSaved={() => {
            setCreatingLine(false);
            setEditingLine(null);
            refresh();
          }}
        />
      )}
      {importingCsv && active && (
        <StationCsvImport
          projectId={active.id}
          surveyId={survey.id}
          onClose={() => setImportingCsv(false)}
          onSaved={() => {
            setImportingCsv(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-semibold mt-1 truncate">{value}</div>
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
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-mono inline-flex items-center gap-1.5 border-b-2 -mb-px ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ----------------------------- Stations Tab ----------------------------- */

function StationsTab({
  stations,
  onCreate,
  onImport,
  onEdit,
  onDeleted,
}: {
  stations: Station[];
  onCreate: () => void;
  onImport: () => void;
  onEdit: (s: Station) => void;
  onDeleted: () => void;
}) {
  const { deleteStation } = useGeophysicsMutations();

  const exportCSV = () => {
    const headers = [
      "station_id",
      "lat",
      "lng",
      "mag_nt",
      "ip_chargeability_mvv",
      "ip_resistivity_ohmm",
      "notes",
    ];
    const rows = stations.map((s) =>
      headers.map((h) => (s as unknown as Record<string, unknown>)[h] ?? "").join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-mono uppercase text-muted-foreground">
          Estaciones de medición
        </h2>
        <div className="flex gap-2">
          {stations.length > 0 && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs font-mono hover:bg-accent"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          )}
          <button
            onClick={onImport}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs font-mono hover:bg-accent"
          >
            <Upload className="w-3 h-3" /> Importar CSV
          </button>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90"
          >
            <Plus className="w-3 h-3" /> Nueva estación
          </button>
        </div>
      </div>

      {stations.length === 0 ? (
        <div className="rounded border border-dashed border-border p-12 text-center">
          <Radio className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sin estaciones aún. Crea una manualmente.</p>
        </div>
      ) : (
        <div className="rounded border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-bg-secondary text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-3">ID</th>
                <th className="text-right py-2 px-3">Lat</th>
                <th className="text-right py-2 px-3">Lng</th>
                <th className="text-right py-2 px-3">Mag (nT)</th>
                <th className="text-right py-2 px-3">IP Carga (mV/V)</th>
                <th className="text-right py-2 px-3">IP Res (Ω·m)</th>
                <th className="text-right py-2 px-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2 px-3 text-foreground">
                    {s.station_id}
                    {s.is_synthetic && <span className="ml-1 text-[9px] text-alert">SIM</span>}
                  </td>
                  <td className="py-2 px-3 text-right">{s.lat.toFixed(5)}</td>
                  <td className="py-2 px-3 text-right">{s.lng.toFixed(5)}</td>
                  <td className="py-2 px-3 text-right">{s.mag_nt?.toFixed(1) ?? "—"}</td>
                  <td className="py-2 px-3 text-right">
                    {s.ip_chargeability_mvv?.toFixed(1) ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {s.ip_resistivity_ohmm?.toFixed(0) ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onEdit(s)}
                        className="p-1 text-muted-foreground hover:text-info"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar estación ${s.station_id}?`)) return;
                          try {
                            await deleteStation(s.id);
                            toast.success("Eliminada");
                            onDeleted();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Error");
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StationDialog({
  projectId,
  surveyId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  surveyId: string;
  initial: Station | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { createStation, updateStation } = useGeophysicsMutations();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    station_id: initial?.station_id ?? "",
    lat: initial?.lat?.toString() ?? "",
    lng: initial?.lng?.toString() ?? "",
    mag_nt: initial?.mag_nt?.toString() ?? "",
    ip_chargeability_mvv: initial?.ip_chargeability_mvv?.toString() ?? "",
    ip_resistivity_ohmm: initial?.ip_resistivity_ohmm?.toString() ?? "",
    notes: initial?.notes ?? "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        station_id: form.station_id.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        mag_nt: form.mag_nt ? Number(form.mag_nt) : null,
        ip_chargeability_mvv: form.ip_chargeability_mvv ? Number(form.ip_chargeability_mvv) : null,
        ip_resistivity_ohmm: form.ip_resistivity_ohmm ? Number(form.ip_resistivity_ohmm) : null,
        notes: form.notes || null,
        is_synthetic: false,
      };
      if (initial) {
        await updateStation(initial.id, payload);
        toast.success("Actualizada");
      } else {
        await createStation(projectId, surveyId, payload);
        toast.success("Creada");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-mono font-semibold">
          {initial ? "Editar estación" : "Nueva estación"}
        </h2>
        <Field label="ID estación" required>
          <input
            required
            value={form.station_id}
            onChange={(e) => setForm((f) => ({ ...f, station_id: e.target.value }))}
            className="input"
            placeholder="ST-001"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitud" required>
            <input
              required
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="Longitud" required>
            <input
              required
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Mag (nT)">
          <input
            type="number"
            step="any"
            value={form.mag_nt}
            onChange={(e) => setForm((f) => ({ ...f, mag_nt: e.target.value }))}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IP Cargabilidad (mV/V)">
            <input
              type="number"
              step="any"
              value={form.ip_chargeability_mvv}
              onChange={(e) => setForm((f) => ({ ...f, ip_chargeability_mvv: e.target.value }))}
              className="input"
            />
          </Field>
          <Field label="IP Resistividad (Ω·m)">
            <input
              type="number"
              step="any"
              value={form.ip_resistivity_ohmm}
              onChange={(e) => setForm((f) => ({ ...f, ip_resistivity_ohmm: e.target.value }))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Notas">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input resize-none"
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
            className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Lines Tab ----------------------------- */

function LinesTab({
  lines,
  onCreate,
  onEdit,
  onDeleted,
}: {
  lines: Line[];
  onCreate: () => void;
  onEdit: (l: Line) => void;
  onDeleted: () => void;
}) {
  const { deleteLine } = useGeophysicsMutations();
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-mono uppercase text-muted-foreground">Líneas de adquisición</h2>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90"
        >
          <Plus className="w-3 h-3" /> Nueva línea
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="rounded border border-dashed border-border p-12 text-center">
          <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            Sin líneas. Pega coordenadas GeoJSON LineString para registrarlas.
          </p>
        </div>
      ) : (
        <div className="rounded border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-bg-secondary text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-3">ID línea</th>
                <th className="text-right py-2 px-3">Vértices</th>
                <th className="text-right py-2 px-3">Longitud (m)</th>
                <th className="text-left py-2 px-3">Notas</th>
                <th className="text-right py-2 px-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2 px-3 text-foreground">
                    {l.line_id}
                    {l.is_synthetic && <span className="ml-1 text-[9px] text-alert">SIM</span>}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {l.geometry_geojson?.coordinates?.length ?? 0}
                  </td>
                  <td className="py-2 px-3 text-right">{l.length_m?.toFixed(0) ?? "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground truncate max-w-xs">
                    {l.notes ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onEdit(l)}
                        className="p-1 text-muted-foreground hover:text-info"
                        title="Editar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar línea ${l.line_id}?`)) return;
                          try {
                            await deleteLine(l.id);
                            toast.success("Eliminada");
                            onDeleted();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Error");
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LineDialog({
  projectId,
  surveyId,
  initial,
  onClose,
  onSaved,
}: {
  projectId: string;
  surveyId: string;
  initial: Line | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { createLine, updateLine } = useGeophysicsMutations();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    line_id: initial?.line_id ?? "",
    coordsText: initial
      ? initial.geometry_geojson.coordinates.map((c) => `${c[1]}, ${c[0]}`).join("\n")
      : "",
    length_m: initial?.length_m?.toString() ?? "",
    notes: initial?.notes ?? "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Parse "lat, lng" lines into [lng, lat]
      const coords: [number, number][] = form.coordsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [lat, lng] = line.split(",").map((n) => Number(n.trim()));
          if (Number.isNaN(lat) || Number.isNaN(lng))
            throw new Error(`Coordenada inválida: "${line}"`);
          return [lng, lat] as [number, number];
        });
      if (coords.length < 2)
        throw new Error("Se requieren al menos 2 vértices (lat, lng por línea)");

      const payload = {
        line_id: form.line_id.trim(),
        geometry_geojson: { type: "LineString" as const, coordinates: coords },
        length_m: form.length_m ? Number(form.length_m) : null,
        notes: form.notes || null,
        is_synthetic: false,
      };
      if (initial) {
        await updateLine(initial.id, payload);
        toast.success("Actualizada");
      } else {
        await createLine(projectId, surveyId, payload);
        toast.success("Creada");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-primary/80 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-border bg-background p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-mono font-semibold">
          {initial ? "Editar línea" : "Nueva línea"}
        </h2>
        <Field label="ID línea" required>
          <input
            required
            value={form.line_id}
            onChange={(e) => setForm((f) => ({ ...f, line_id: e.target.value }))}
            className="input"
            placeholder="L-01"
          />
        </Field>
        <Field label="Vértices (uno por línea: lat, lng)" required>
          <textarea
            required
            rows={6}
            value={form.coordsText}
            onChange={(e) => setForm((f) => ({ ...f, coordsText: e.target.value }))}
            className="input font-mono resize-none"
            placeholder={"-33.4567, -70.6789\n-33.4570, -70.6800"}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Longitud (m)">
            <input
              type="number"
              step="1"
              value={form.length_m}
              onChange={(e) => setForm((f) => ({ ...f, length_m: e.target.value }))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Notas">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input resize-none"
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
            className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {initial ? "Guardar" : "Crear"}
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
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
