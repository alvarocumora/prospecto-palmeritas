// Command Center — shell visual cinematográfico 16:9.
// Sprint 5.0: reusa GeoSceneCanvas + KPIs existentes. Sin nuevo backend.
// Layout: header / sidebar narrow / central canvas / right column / bottom analytics / ticker.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Cloud,
  Crosshair,
  Drill,
  FileSignature,
  Gauge,
  Layers,
  Mountain,
  Radio,
  Satellite,
  Settings,
  ShieldCheck,
  Sparkles,
  Target as TargetIcon,
  TestTube2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useProjects } from "@/hooks/useProjects";
import { useExecutiveKpis } from "@/hooks/useExecutiveKpis";
import { GeoSceneCanvas } from "@/components/geoscene/canvas/GeoSceneCanvas";
import { SceneCopilot } from "@/components/geoscene/SceneCopilot";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/command-center")({
  head: () => ({
    meta: [
      { title: "Centro de Control Geológico — Geocapitals" },
      {
        name: "description",
        content:
          "Centro de control operacional: exploración, perforación, geofísica y AI targeting en tiempo real.",
      },
    ],
  }),
  component: CommandCenter,
});

// ---------- Sidebar (rutas existentes) ----------
const NAV: Array<{ to: string; icon: typeof Activity; label: string }> = [
  { to: "/dashboard", icon: Activity, label: "Resumen Ejecutivo" },
  { to: "/dashboard/targets", icon: Crosshair, label: "Exploración" },
  { to: "/dashboard/geology3d", icon: Mountain, label: "Geología 3D" },
  { to: "/dashboard/geophysics", icon: Radio, label: "Geofísica" },
  { to: "/dashboard/sampling", icon: TestTubeIcon, label: "Geoquímica" },
  { to: "/dashboard/drilling", icon: Drill, label: "Perforación" },
  { to: "/dashboard/estimation", icon: Layers, label: "Modelado de Recursos" },
  { to: "/dashboard/targets/ai-brief", icon: Sparkles, label: "AI Targeting" },
  { to: "/dashboard/satellite-intel", icon: Satellite, label: "Satelital" },
  { to: "/dashboard/qaqc", icon: ShieldCheck, label: "QA/QC" },
  { to: "/dashboard/hse", icon: ShieldCheck, label: "ESG / HSE" },
  { to: "/dashboard/ni43101", icon: FileSignature, label: "Reportes NI 43-101" },
  { to: "/dashboard/marketplace", icon: TargetIcon, label: "Deals" },
];

function TestTubeIcon(props: React.ComponentProps<typeof Activity>) {
  return <Activity {...props} />;
}

// ---------- Componente principal ----------
function CommandCenter() {
  const { projects, active, setActiveId } = useProjects();
  const { kpis, loading } = useExecutiveKpis();
  const [mode, setMode] = useState<"surface" | "subsurface">("subsurface");
  const now = useNow();

  return (
    <div className="fixed inset-0 bg-background text-foreground overflow-hidden">
      {/* === HEADER === */}
      <header className="h-14 border-b border-border bg-bg-secondary/80 backdrop-blur flex items-center px-4 gap-4 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm border border-gold/40 bg-gradient-to-br from-gold/30 to-gold/5 flex items-center justify-center">
            <Mountain className="w-4 h-4 text-gold" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold tracking-tight leading-none text-gold">
              GEOCAPITALS
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
              Exploramos valor · Descubrimos futuro
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 ml-6 pl-6 border-l border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Centro de Control Geológico
          </div>
          <div className="text-[10px] font-mono text-signal-cyan">
            Exploración · Análisis · Targeting AI
          </div>
        </div>

        <div className="flex-1" />

        <Weather />
        <ClockBlock now={now} />
        <ProjectSelector
          projects={projects}
          activeId={active?.id ?? null}
          onChange={setActiveId}
        />
        <button className="relative w-9 h-9 rounded border border-border bg-bg-elevated hover:bg-accent transition-colors flex items-center justify-center">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {kpis && kpis.alertsUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-signal-red text-[9px] font-mono font-bold text-background flex items-center justify-center">
              {Math.min(99, kpis.alertsUnread)}
            </span>
          )}
        </button>
        <Link
          to="/dashboard/profile"
          className="w-9 h-9 rounded border border-border bg-bg-elevated hover:bg-accent transition-colors flex items-center justify-center"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Link>
      </header>

      {/* === BODY: sidebar + grid === */}
      <div className="absolute inset-0 top-14 bottom-7 flex">
        {/* Sidebar */}
        <aside className="w-14 border-r border-border bg-bg-secondary/60 flex flex-col items-center py-3 gap-1 overflow-y-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="group relative w-10 h-10 rounded flex items-center justify-center text-muted-foreground hover:text-signal-cyan hover:bg-accent transition-colors"
              title={n.label}
            >
              <n.icon className="w-4 h-4" />
              <span className="absolute left-12 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-popover border border-border text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                {n.label}
              </span>
            </Link>
          ))}
        </aside>

        {/* Grid principal */}
        <div className="flex-1 grid grid-cols-12 grid-rows-12 gap-2 p-2 min-w-0">
          {/* Central canvas — 7 cols × 8 rows */}
          <div className="col-span-7 row-span-8 relative rounded border border-border-hot bg-bg-panel/40 overflow-hidden">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
              <ModeBtn active={mode === "surface"} onClick={() => setMode("surface")}>
                Superficie
              </ModeBtn>
              <ModeBtn active={mode === "subsurface"} onClick={() => setMode("subsurface")}>
                Subsuelo
              </ModeBtn>
            </div>
            <div className="absolute top-2 right-2 z-10 text-[9px] font-mono text-signal-cyan border border-signal-cyan/40 bg-bg-secondary/70 backdrop-blur px-2 py-1 rounded uppercase tracking-wider">
              ● Real-time · {active?.code ?? "—"}
            </div>
            <GeoSceneCanvas mode={mode} />
          </div>

          {/* Anomaly Summary — 2 cols × 4 rows */}
          <Panel
            className="col-span-2 row-span-4"
            label="Resumen Anomalías"
            accent="cyan"
          >
            <AnomalySummary projectId={active?.id ?? null} />
          </Panel>

          {/* Activity / Drilling — 3 cols × 4 rows */}
          <Panel
            className="col-span-3 row-span-4"
            label="Actividad de Perforación"
            accent="amber"
          >
            <DrillingActivity kpis={kpis} loading={loading} />
          </Panel>

          {/* AI Copilot — 2 cols × 4 rows (debajo de anomaly summary) */}
          <Panel
            className="col-span-2 row-span-4"
            label="AI Copilot"
            accent="violet"
            padded={false}
          >
            <div className="absolute inset-0 overflow-hidden">
              <SceneCopilot />
            </div>
          </Panel>

          {/* Alerts — 3 cols × 4 rows */}
          <Panel
            className="col-span-3 row-span-4"
            label="Alertas y Notificaciones"
            accent="red"
          >
            <AlertsFeed kpis={kpis} />
          </Panel>

          {/* Bottom row — 4 paneles de analítica */}
          <Panel className="col-span-3 row-span-4" label="KPI Operacional · Cumplimiento" accent="green">
            <GaugeBlock
              value={kpis ? clamp01(kpis.approvedRecords / Math.max(1, kpis.approvedRecords + kpis.pendingReview + kpis.draftRecords)) : 0}
              label="Aprobado"
              unit="%"
              color="green"
            />
          </Panel>
          <Panel className="col-span-3 row-span-4" label="KPI · QA/QC" accent="amber">
            <GaugeBlock
              value={kpis?.qaqcFailRate != null ? 1 - kpis.qaqcFailRate : null}
              label="Tasa Aprobado"
              unit="%"
              color="amber"
            />
          </Panel>
          <Panel className="col-span-3 row-span-4" label="Targets Activos" accent="cyan">
            <BigStat
              value={kpis?.activeTargets ?? "—"}
              sub={`${kpis?.activeCampaigns ?? 0} campañas en curso`}
            />
          </Panel>
          <Panel className="col-span-3 row-span-4" label="Geofísica · Inversión" accent="violet">
            <BigStat
              value={
                kpis
                  ? `US$ ${(kpis.totalGeophysicsCapex / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`
                  : "—"
              }
              sub={`${kpis?.monthInterceptCount ?? 0} intercepts este mes`}
            />
          </Panel>
        </div>
      </div>

      {/* === FOOTER TICKER === */}
      <footer className="absolute bottom-0 left-0 right-0 h-7 border-t border-border bg-bg-secondary/80 backdrop-blur flex items-center px-4 gap-6 text-[10px] font-mono z-20">
        <div className="text-muted-foreground uppercase tracking-wider">Mercado</div>
        <Ticker label="Cu" unit="US$/lb" value="4.21" delta="+1.2%" up />
        <Ticker label="Au" unit="US$/oz" value="2,347" delta="+0.8%" up />
        <Ticker label="Ag" unit="US$/oz" value="28.65" delta="+1.5%" up />
        <Ticker label="Li" unit="US$/t" value="14,200" delta="-0.4%" up={false} />
        <div className="flex-1" />
        <div className="text-muted-foreground">Última sincronización · {now.toLocaleTimeString()}</div>
      </footer>
    </div>
  );
}

// =================================================================
// SUB-COMPONENTS
// =================================================================

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function Weather() {
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-bg-elevated">
      <Cloud className="w-3.5 h-3.5 text-signal-cyan" />
      <div className="text-[10px] font-mono">
        <div className="text-foreground">22°C · Despejado</div>
        <div className="text-muted-foreground">Viento 12 km/h NW</div>
      </div>
    </div>
  );
}

function ClockBlock({ now }: { now: Date }) {
  return (
    <div className="hidden md:flex flex-col px-3 py-1.5 rounded border border-border bg-bg-elevated">
      <div className="text-sm font-mono font-bold text-foreground leading-none">
        {now.toLocaleTimeString(undefined, { hour12: false })}
      </div>
      <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">
        {now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}

function ProjectSelector({
  projects,
  activeId,
  onChange,
}: {
  projects: Array<{ id: string; code: string; name?: string | null }>;
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground px-1">Proyecto</div>
      <select
        value={activeId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-signal-cyan min-w-[180px]"
      >
        {projects.length === 0 && <option value="">— sin proyectos —</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name ?? ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ModeBtn({
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
      className={`px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors ${
        active
          ? "border-signal-cyan/60 bg-signal-cyan/10 text-signal-cyan"
          : "border-border bg-bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  className,
  label,
  accent,
  children,
  padded = true,
}: {
  className?: string;
  label: string;
  accent?: "cyan" | "amber" | "red" | "green" | "violet";
  children: React.ReactNode;
  padded?: boolean;
}) {
  const accentClass = {
    cyan: "border-signal-cyan/30",
    amber: "border-signal-amber/30",
    red: "border-signal-red/30",
    green: "border-signal-green/30",
    violet: "border-signal-violet/30",
  }[accent ?? "cyan"];
  const labelClass = {
    cyan: "text-signal-cyan",
    amber: "text-signal-amber",
    red: "text-signal-red",
    green: "text-signal-green",
    violet: "text-signal-violet",
  }[accent ?? "cyan"];
  return (
    <div
      className={`relative rounded border ${accentClass} bg-bg-panel/60 backdrop-blur overflow-hidden ${className ?? ""}`}
    >
      <div
        className={`text-[9px] uppercase tracking-[0.18em] font-mono ${labelClass} px-3 pt-2 pb-1 border-b border-border/40`}
      >
        {label}
      </div>
      <div className={padded ? "p-3 h-[calc(100%-26px)] overflow-hidden" : "h-[calc(100%-26px)]"}>
        {children}
      </div>
    </div>
  );
}

function GaugeBlock({
  value,
  label,
  unit,
  color,
}: {
  value: number | null;
  label: string;
  unit: string;
  color: "green" | "amber" | "red" | "cyan";
}) {
  const colorVar = {
    green: "var(--signal-green)",
    amber: "var(--signal-amber)",
    red: "var(--signal-red)",
    cyan: "var(--signal-cyan)",
  }[color];
  const pct = value == null ? 0 : Math.round(value * 100);
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (value ?? 0));
  return (
    <div className="flex items-center justify-center h-full gap-3">
      <svg viewBox="0 0 100 100" className="w-24 h-24">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={colorVar}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50"
          y="54"
          textAnchor="middle"
          fontSize="20"
          fontFamily="monospace"
          fontWeight="700"
          fill="var(--foreground)"
        >
          {value == null ? "—" : pct}
        </text>
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fill="var(--muted-foreground)"
        >
          {unit}
        </text>
      </svg>
      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function BigStat({ value, sub }: { value: React.ReactNode; sub: string }) {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-3xl font-mono font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{sub}</div>
    </div>
  );
}

function Ticker({
  label,
  unit,
  value,
  delta,
  up,
}: {
  label: string;
  unit: string;
  value: string;
  delta: string;
  up: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-[9px] text-hint">({unit})</span>
      <span className="text-foreground font-bold tabular-nums">{value}</span>
      <span
        className={`flex items-center gap-0.5 ${up ? "text-signal-green" : "text-signal-red"}`}
      >
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {delta}
      </span>
    </div>
  );
}

// ---------- Data widgets ----------

function AnomalySummary({ projectId }: { projectId: string | null }) {
  const [counts, setCounts] = useState<{ critical: number; high: number; medium: number; low: number; total: number }>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  });
  useEffect(() => {
    if (!projectId) {
      setCounts({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
      return;
    }
    let cancelled = false;
    supabase
      .from("geophysics_anomalies")
      .select("severity")
      .eq("project_id", projectId)
      .neq("status", "dismissed")
      .then(({ data }) => {
        if (cancelled) return;
        const c = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
        for (const r of (data ?? []) as Array<{ severity: string | null }>) {
          c.total += 1;
          const s = (r.severity ?? "medium").toLowerCase() as keyof typeof c;
          if (s in c) (c as Record<string, number>)[s] += 1;
        }
        setCounts(c);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const Row = ({ label, n, color }: { label: string; n: number; color: string }) => (
    <div className="flex items-center justify-between text-[11px] font-mono py-1">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <span className="text-foreground font-bold tabular-nums">{n}</span>
    </div>
  );
  return (
    <div className="flex flex-col h-full">
      <div className="text-3xl font-mono font-bold text-signal-cyan tabular-nums leading-none">
        {counts.total}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
        Detectadas
      </div>
      <div className="mt-3 border-t border-border/40 pt-2 flex-1">
        <Row label="Crítica" n={counts.critical} color="var(--signal-violet)" />
        <Row label="Alta" n={counts.high} color="var(--signal-red)" />
        <Row label="Media" n={counts.medium} color="var(--signal-amber)" />
        <Row label="Baja" n={counts.low} color="var(--signal-green)" />
      </div>
    </div>
  );
}

function DrillingActivity({
  kpis,
  loading,
}: {
  kpis: ReturnType<typeof useExecutiveKpis>["kpis"];
  loading: boolean;
}) {
  if (loading || !kpis) {
    return <div className="text-xs font-mono text-muted-foreground">Cargando…</div>;
  }
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      <div>
        <div className="text-2xl font-mono font-bold text-signal-amber tabular-nums leading-none">
          {kpis.totalHoles}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
          Sondajes
        </div>
      </div>
      <div>
        <div className="text-2xl font-mono font-bold text-foreground tabular-nums leading-none">
          {kpis.totalMetersDrilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
          Metros (acum.)
        </div>
      </div>
      <div>
        <div className="text-2xl font-mono font-bold text-signal-cyan tabular-nums leading-none">
          {kpis.totalSamples.toLocaleString()}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
          Muestras
        </div>
      </div>
      <div className="col-span-3 border-t border-border/40 pt-2 text-[10px] font-mono text-muted-foreground space-y-1 overflow-y-auto">
        <div className="flex justify-between">
          <span>Au promedio (ponderado)</span>
          <span className="text-gold font-bold tabular-nums">
            {kpis.auWeightedAvg != null ? `${kpis.auWeightedAvg.toFixed(2)} g/t` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Intercepts del mes</span>
          <span className="text-foreground font-bold tabular-nums">{kpis.monthInterceptCount}</span>
        </div>
        <Link
          to="/dashboard/drilling"
          className="block mt-2 text-signal-cyan hover:underline uppercase tracking-wider text-[9px]"
        >
          Ver perforación →
        </Link>
      </div>
    </div>
  );
}

function AlertsFeed({ kpis }: { kpis: ReturnType<typeof useExecutiveKpis>["kpis"] }) {
  const items = useMemo(() => {
    if (!kpis) return [];
    return [
      kpis.concessionsExpiring90d > 0 && {
        kind: "warn" as const,
        text: `${kpis.concessionsExpiring90d} concesiones vencen en 90 días`,
        to: "/dashboard/catastro",
      },
      kpis.patentsDue > 0 && {
        kind: "alert" as const,
        text: `${kpis.patentsDue} patentes con pago pendiente`,
        to: "/dashboard/catastro",
      },
      kpis.overlapsOpen > 0 && {
        kind: "warn" as const,
        text: `${kpis.overlapsOpen} superposiciones de catastro abiertas`,
        to: "/dashboard/catastro",
      },
      kpis.pendingReview > 0 && {
        kind: "info" as const,
        text: `${kpis.pendingReview} registros en revisión QA/QC`,
        to: "/dashboard/approvals",
      },
      kpis.bulletinsUnread > 0 && {
        kind: "info" as const,
        text: `${kpis.bulletinsUnread} boletines mineros sin leer`,
        to: "/dashboard/boletin",
      },
    ].filter(Boolean) as Array<{ kind: "warn" | "alert" | "info"; text: string; to: string }>;
  }, [kpis]);
  if (items.length === 0) {
    return (
      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
        <Gauge className="w-3.5 h-3.5 text-signal-green" />
        Sin alertas activas
      </div>
    );
  }
  return (
    <div className="space-y-1.5 overflow-y-auto h-full pr-1">
      {items.map((it, i) => (
        <Link
          key={i}
          to={it.to}
          className="flex items-start gap-2 text-[11px] font-mono p-1.5 rounded hover:bg-accent transition-colors"
        >
          <AlertTriangle
            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
              it.kind === "alert"
                ? "text-signal-red"
                : it.kind === "warn"
                  ? "text-signal-amber"
                  : "text-signal-cyan"
            }`}
          />
          <span className="text-foreground">{it.text}</span>
        </Link>
      ))}
    </div>
  );
}
