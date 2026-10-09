import { Link, ClientOnly } from "@tanstack/react-router";
import { lazy, useMemo, useRef, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canWrite } from "@/hooks/useProjectRole";
import {
  useExplorationTargets,
  TARGET_STAGES,
  STAGE_META,
  PRIORITY_META,
  type TargetStage,
  type TargetPriority,
  type TargetType,
  type ExplorationTarget,
} from "@/hooks/useExplorationTargets";
import {
  Target,
  Plus,
  ChevronRight,
  ChevronLeft,
  X,
  Trash2,
  MapPin,
  Sparkles,
  LayoutGrid,
  Map as MapIcon,
  Trophy,
  FileDown,
  Loader2,
  Satellite,
} from "lucide-react";
import { toast } from "sonner";
// react-leaflet toca `window` al importarse: cargar solo en cliente (evita crash SSR).
const TargetsMap = lazy(() =>
  import("@/components/targets/TargetsMap").then((m) => ({ default: m.TargetsMap })),
);
import { TargetsExecutivePanel } from "@/components/targets/TargetsExecutivePanel";
import { snapshotElement, buildTargetsPDF } from "@/lib/exportTargetsPDF";
import { InstallPWAButton } from "@/components/pwa/InstallPWAButton";
import { useProjectMiningConcessions } from "@/hooks/useProjectMiningConcessions";
import {
  useProjectSatelliteAnomalies,
  SAT_INDEX_CODES,
} from "@/hooks/useProjectSatelliteAnomalies";
import { useRunSatelliteAnalysisOnTargets } from "@/hooks/useRunSatelliteAnalysisOnTargets";
import { useSatelliteAnalysisProgress } from "@/hooks/useSatelliteAnalysisProgress";
import { SatelliteAnalysisProgress } from "@/components/targets/SatelliteAnalysisProgress";

export function TargetsPage({ projectId }: { projectId: string }) {
  const { projects } = useProjects();
  const active = projects.find((project) => project.id === projectId);
  const role = useProjectRole();
  const { targets, loading, addTarget, updateStage, deleteTarget } =
    useExplorationTargets(projectId);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"kanban" | "map" | "ranking">("kanban");
  const [exporting, setExporting] = useState(false);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const rankingWrapRef = useRef<HTMLDivElement | null>(null);
  const writable = canWrite(role);

  const { data: concessions } = useProjectMiningConcessions(projectId);
  const { data: anomaliesByIndex } = useProjectSatelliteAnomalies(projectId);
  const runSat = useRunSatelliteAnalysisOnTargets();
  const [runStartedAt, setRunStartedAt] = useState<Date | null>(null);
  const [expectedAnomalies, setExpectedAnomalies] = useState(0);
  const satProgress = useSatelliteAnalysisProgress({
    projectId: projectId,
    enabled: runSat.isPending,
    startedAt: runStartedAt,
    expectedRuns: SAT_INDEX_CODES.length,
    expectedAnomalies,
  });

  async function handleRunSatellite() {
    if (!active || targets.length === 0) return;
    const top10 = [...targets]
      .filter((t) => t.lat != null && t.lng != null)
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .slice(0, 10);
    if (top10.length === 0) {
      toast.error("No hay targets con coordenadas");
      return;
    }
    setRunStartedAt(new Date());
    setExpectedAnomalies(top10.length * SAT_INDEX_CODES.length);
    try {
      const res = await runSat.mutateAsync({
        projectId: active.id,
        targetIds: top10.map((t) => t.id),
        indexCodes: [...SAT_INDEX_CODES],
      });
      if (!res.ok) throw new Error(res.error ?? "Error");
      const totalAnoms = Object.values(res.anomaliesByIndex).reduce((s, n) => s + n, 0);
      toast.success(`Análisis listo · ${res.runs.length} índices · ${totalAnoms} anomalías`);
    } catch (e) {
      toast.error(`No se pudo correr análisis: ${(e as Error).message}`);
    }
  }

  async function handleExportPDF() {
    if (!active || targets.length === 0) return;
    setExporting(true);
    const prevView = view;
    try {
      toast.info("Generando PDF, espera unos segundos…");

      // Capture map
      setView("map");
      await new Promise((r) => setTimeout(r, 2500));
      const mapCanvas = mapWrapRef.current ? await snapshotElement(mapWrapRef.current) : null;

      // Capture ranking
      setView("ranking");
      await new Promise((r) => setTimeout(r, 700));
      const rankingCanvas = rankingWrapRef.current
        ? await snapshotElement(rankingWrapRef.current)
        : null;

      const holders = new Set((concessions ?? []).map((c) => c.holder ?? "").filter(Boolean));
      const concAreaHa = (concessions ?? []).reduce((s, c) => s + Number(c.area_ha ?? 0), 0);
      const anomCounts: Record<string, number> = {};
      if (anomaliesByIndex) {
        for (const k of SAT_INDEX_CODES) anomCounts[k] = anomaliesByIndex[k]?.length ?? 0;
      }
      buildTargetsPDF({
        mapCanvas,
        rankingCanvas,
        projectName: active.name ?? active.code,
        projectCode: active.code,
        targetsCount: targets.length,
        layersSummary: {
          concessionsCount: concessions?.length ?? 0,
          holdersCount: holders.size,
          concessionsAreaHa: concAreaHa,
          anomalyCounts: anomCounts,
        },
      });
      toast.success("PDF descargado");
    } catch (e) {
      toast.error("No se pudo generar PDF");
      console.error(e);
    } finally {
      setView(prevView);
      setExporting(false);
    }
  }

  const grouped = useMemo(() => {
    const m: Record<TargetStage, ExplorationTarget[]> = {
      generated: [],
      validated: [],
      drill_ready: [],
      drilling: [],
      drilled: [],
      closed: [],
    };
    for (const t of targets) m[t.stage].push(t);
    return m;
  }, [targets]);

  const stats = useMemo(
    () => ({
      total: targets.length,
      drillReady: grouped.drill_ready.length,
      active: targets.filter((t) => t.stage !== "closed" && t.stage !== "drilled").length,
      plannedMeters: targets
        .filter((t) => t.stage === "drill_ready")
        .reduce((s, t) => s + (Number(t.planned_meters) || 0), 0),
    }),
    [targets, grouped],
  );

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  async function move(id: string, dir: "next" | "prev") {
    const t = targets.find((x) => x.id === id);
    if (!t) return;
    const idx = TARGET_STAGES.indexOf(t.stage);
    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= TARGET_STAGES.length) return;
    const next = TARGET_STAGES[nextIdx];
    let reason: string | undefined;
    if (next === "closed") {
      reason = window.prompt("Motivo de cierre del target:") ?? undefined;
      if (reason === undefined) return;
    }
    const { error } = await updateStage(id, next, reason);
    if (error) toast.error(error);
    else toast.success(`${t.code} → ${STAGE_META[next].label}`);
  }

  async function onDelete(t: ExplorationTarget) {
    if (!window.confirm(`¿Eliminar target ${t.code}? No se puede deshacer.`)) return;
    const { error } = await deleteTarget(t.id);
    if (error) toast.error(error);
    else toast.success("Eliminado");
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto pb-20 md:pb-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Proyecto · {active.code}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1 inline-flex items-center gap-2">
            <Target className="w-5 h-5 text-gold" /> Targets Pipeline
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Generación → Validación → Drill-Ready → Perforación. Convierte exploración en
            decisiones.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`px-2.5 py-1.5 text-xs font-mono inline-flex items-center gap-1.5 ${view === "kanban" ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-accent"}`}
            >
              <LayoutGrid className="w-3 h-3" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={`px-2.5 py-1.5 text-xs font-mono inline-flex items-center gap-1.5 border-l border-border ${view === "map" ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-accent"}`}
            >
              <MapIcon className="w-3 h-3" /> Mapa
            </button>
            <button
              type="button"
              onClick={() => setView("ranking")}
              className={`px-2.5 py-1.5 text-xs font-mono inline-flex items-center gap-1.5 border-l border-border ${view === "ranking" ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-accent"}`}
            >
              <Trophy className="w-3 h-3" /> Ranking
            </button>
          </div>
          <InstallPWAButton />
          <button
            type="button"
            onClick={handleRunSatellite}
            disabled={runSat.isPending || targets.length === 0}
            className="px-3 py-1.5 text-xs font-mono rounded border border-signal-cyan/40 text-signal-cyan bg-signal-cyan/5 hover:bg-signal-cyan/10 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Corre análisis Sentinel-2 multi-índice sobre los 10 targets de mayor score"
          >
            {runSat.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Satellite className="w-3 h-3" />
            )}
            {runSat.isPending ? "Analizando…" : "Correr análisis satelital"}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exporting || targets.length === 0}
            className="px-3 py-1.5 text-xs font-mono rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exporta mapa + ranking a PDF para enviar por correo o WhatsApp"
          >
            {exporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3" />
            )}
            {exporting ? "Generando…" : "Exportar PDF"}
          </button>
          <Link
            to="/dashboard/targets/ai-brief"
            search={{ project: projectId }}
            className="px-3 py-1.5 text-xs font-mono rounded border border-info/40 text-info bg-info/5 hover:bg-info/10 inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" /> AI Brief Preview
          </Link>
          {writable && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-xs font-mono rounded border border-gold/40 text-gold bg-gold/5 hover:bg-gold/10 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" /> Nuevo target
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Activos" value={String(stats.active)} color="text-info" />
        <Stat label="Drill-Ready" value={String(stats.drillReady)} color="text-gold" />
        <Stat
          label="m planificados"
          value={stats.plannedMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          color="text-copper"
        />
      </div>

      {runSat.isPending && (
        <SatelliteAnalysisProgress
          progress={satProgress}
          expectedRuns={SAT_INDEX_CODES.length}
          expectedAnomalies={expectedAnomalies}
        />
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : targets.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-bg-secondary p-12 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <div className="font-mono text-sm">Sin targets aún</div>
          <p className="text-xs text-muted-foreground mt-1">
            Crea tu primer target con la evidencia geológica/geofísica que lo respalde.
          </p>
        </div>
      ) : view === "map" ? (
        <div ref={mapWrapRef}>
          <ClientOnly fallback={<div className="h-[600px] w-full animate-pulse bg-muted/20" />}>
            <TargetsMap
              targets={targets}
              concessions={concessions}
              anomaliesByIndex={anomaliesByIndex}
            />
          </ClientOnly>
        </div>
      ) : view === "ranking" ? (
        <div ref={rankingWrapRef}>
          <TargetsExecutivePanel targets={targets} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {TARGET_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              targets={grouped[stage]}
              writable={writable}
              onNext={(id) => move(id, "next")}
              onPrev={(id) => move(id, "prev")}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showForm && active && (
        <TargetDialog
          projectId={active.id}
          onClose={() => setShowForm(false)}
          onSaved={async (t) => {
            const { error } = await addTarget(t);
            if (error) toast.error(error);
            else {
              toast.success("Target creado");
              setShowForm(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Column({
  stage,
  targets,
  writable,
  onNext,
  onPrev,
  onDelete,
}: {
  stage: TargetStage;
  targets: ExplorationTarget[];
  writable: boolean;
  onNext: (id: string) => void;
  onPrev: (id: string) => void;
  onDelete: (t: ExplorationTarget) => void;
}) {
  const meta = STAGE_META[stage];
  return (
    <div className="rounded border border-border bg-bg-secondary flex flex-col min-h-[200px]">
      <div
        className={`px-2.5 py-2 border-b border-border flex items-center justify-between ${meta.color
          .split(" ")
          .filter((c) => c.startsWith("bg-"))
          .join(" ")}`}
      >
        <div
          className={`text-[10px] font-mono uppercase tracking-wider ${meta.color.split(" ").find((c) => c.startsWith("text-")) ?? ""}`}
        >
          {meta.label}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">{targets.length}</div>
      </div>
      <div className="p-2 space-y-2 flex-1">
        {targets.length === 0 && (
          <div className="text-[10px] font-mono text-muted-foreground text-center py-4 opacity-60">
            Vacío
          </div>
        )}
        {targets.map((t) => (
          <Card
            key={t.id}
            target={t}
            writable={writable}
            onNext={onNext}
            onPrev={onPrev}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function Card({
  target,
  writable,
  onNext,
  onPrev,
  onDelete,
}: {
  target: ExplorationTarget;
  writable: boolean;
  onNext: (id: string) => void;
  onPrev: (id: string) => void;
  onDelete: (t: ExplorationTarget) => void;
}) {
  const idx = TARGET_STAGES.indexOf(target.stage);
  const canPrev = idx > 0;
  const canNext = idx < TARGET_STAGES.length - 1;
  const pri = PRIORITY_META[target.priority];
  return (
    <div className="rounded border border-border bg-background p-2 hover:border-gold/30 transition-colors">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-muted-foreground">{target.code}</div>
          <div className="text-xs font-semibold truncate">{target.name}</div>
        </div>
        <span className={`text-[9px] font-mono uppercase px-1 py-0.5 rounded border ${pri.color}`}>
          {pri.label}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
        <span>{target.target_type}</span>
        {target.commodity && <span>· {target.commodity}</span>}
        {target.score != null && (
          <span className="ml-auto text-gold">★ {Number(target.score).toFixed(0)}</span>
        )}
      </div>

      {target.lat != null && target.lng != null && (
        <div className="mt-1 text-[9px] font-mono text-muted-foreground inline-flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5" /> {target.lat.toFixed(4)}, {target.lng.toFixed(4)}
        </div>
      )}

      {target.planned_meters != null && (
        <div className="mt-1 text-[9px] font-mono text-copper">
          {target.planned_meters} m planificados
        </div>
      )}

      {target.rationale && (
        <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">{target.rationale}</p>
      )}

      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between gap-1">
        {writable ? (
          <button
            type="button"
            onClick={() => canPrev && onPrev(target.id)}
            disabled={!canPrev}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
            title="Etapa anterior"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        ) : (
          <span />
        )}
        <Link
          to="/dashboard/targets/ai-brief"
          search={{ targetId: target.id }}
          className="p-1 rounded text-info hover:bg-info/10 inline-flex items-center gap-1 text-[10px] font-mono"
          title="Abrir AI Brief con evidencia geológica de este target"
        >
          <Sparkles className="w-3 h-3" /> Brief
        </Link>
        {writable ? (
          <>
            <button
              type="button"
              onClick={() => onDelete(target)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => canNext && onNext(target.id)}
              disabled={!canNext}
              className="p-1 rounded hover:bg-accent text-gold disabled:opacity-30 disabled:cursor-not-allowed"
              title="Siguiente etapa"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function TargetDialog({
  projectId: _projectId,
  onClose,
  onSaved,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: (t: Partial<ExplorationTarget> & { code: string; name: string }) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [target_type, setTargetType] = useState<TargetType>("vein");
  const [commodity, setCommodity] = useState("Au");
  const [target_zone, setZone] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [priority, setPriority] = useState<TargetPriority>("medium");
  const [score, setScore] = useState("60");
  const [planned_meters, setMeters] = useState("");
  const [estimated_cost_usd, setCost] = useState("");
  const [rationale, setRationale] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-mono text-sm font-semibold inline-flex items-center gap-2">
            <Target className="w-4 h-4 text-gold" /> Nuevo target exploratorio
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim() || !name.trim()) {
              toast.error("Código y nombre son requeridos");
              return;
            }
            onSaved({
              code: code.trim().toUpperCase(),
              name: name.trim(),
              target_type,
              commodity: commodity || null,
              target_zone: target_zone || null,
              lat: lat ? Number(lat) : null,
              lng: lng ? Number(lng) : null,
              priority,
              score: score ? Number(score) : 50,
              planned_meters: planned_meters ? Number(planned_meters) : null,
              estimated_cost_usd: estimated_cost_usd ? Number(estimated_cost_usd) : null,
              rationale: rationale || null,
            });
          }}
          className="p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código" required>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TGT-001"
                required
              />
            </Field>
            <Field label="Tipo">
              <select
                className="input"
                value={target_type}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
              >
                {(
                  [
                    "vein",
                    "disseminated",
                    "skarn",
                    "porphyry",
                    "epithermal",
                    "iocg",
                    "vms",
                    "placer",
                    "other",
                  ] as TargetType[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Nombre" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Veta Norte profunda"
              required
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Commodity">
              <input
                className="input"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="Au"
              />
            </Field>
            <Field label="Zona">
              <input
                className="input"
                value={target_zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Sector A"
              />
            </Field>
            <Field label="Prioridad">
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TargetPriority)}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud">
              <input
                className="input"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </Field>
            <Field label="Longitud">
              <input
                className="input"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Score 0-100">
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </Field>
            <Field label="m planificados">
              <input
                className="input"
                type="number"
                value={planned_meters}
                onChange={(e) => setMeters(e.target.value)}
              />
            </Field>
            <Field label="Costo USD">
              <input
                className="input"
                type="number"
                value={estimated_cost_usd}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Justificación geológica">
            <textarea
              className="input min-h-[80px]"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Anomalía cargabilidad IP coincidente con alteración argílica avanzada y rock chips Au > 1 g/t…"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-background hover:bg-gold/90"
            >
              Crear
            </button>
          </div>
        </form>
      </div>
      <style>{`.input { width: 100%; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 4px; padding: 6px 8px; font-family: ui-monospace, monospace; font-size: 12px; }`}</style>
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
      <span className="text-[10px] font-mono uppercase text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
