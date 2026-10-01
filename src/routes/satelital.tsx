import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Satellite,
  Activity,
  AlertTriangle,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Radio,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Box as BoxIcon,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { BrandCard, Eyebrow, SectionHeading, VerificationBadge } from "@/components/brand";
import { SatAnomalyMiniMap } from "@/features/marketing/SatAnomalyMiniMap";
import { getPublicSatellite, type PublicSatProject } from "@/lib/publicSatellite.functions";
import { projectVerification } from "@/lib/verification";
import { QueryError } from "@/components/ui/QueryError";

type SatelitalSearch = {
  project?: string;
};

export const Route = createFileRoute("/satelital")({
  validateSearch: (search: Record<string, unknown>): SatelitalSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Monitoreo satelital minero — Geocapitals" },
      {
        name: "description",
        content:
          "Detección de anomalías multiespectrales y deformación InSAR sobre los proyectos mineros monitoreados en Geocapitals. Datos Sentinel y Copernicus procesados en el Terminal.",
      },
      { property: "og:title", content: "Monitoreo satelital minero — Geocapitals" },
      {
        property: "og:description",
        content:
          "Anomalías satelitales, InSAR y series temporales sobre los proyectos mineros de la plataforma.",
      },
      { property: "og:url", content: "https://geocapitals.com/satelital" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/satelital" }],
  }),
  component: SatelitalPage,
  errorComponent: SatelitalError,
  notFoundComponent: () => <p className="p-10 text-center">No hay datos disponibles.</p>,
});

function SatelitalError({ error: rawError }: { error: unknown }) {
  const error = rawError as Error;
  return (
    <main className="min-h-screen bg-surface">
      <MarketingHeader />
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <h1 className="brand-display text-2xl mb-3">No pudimos cargar el monitoreo satelital</h1>
        <p className="text-content-subtle text-sm mb-6">{error.message}</p>
        <Link to="/" className="text-accent-brand hover:underline">
          ← Volver al inicio
        </Link>
      </div>
      <MarketingFooter />
    </main>
  );
}

const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 border-red-500/30",
  high: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
type SevKey = (typeof SEVERITIES)[number] | "all";

function sevBadge(sev: string | null) {
  const key = (sev ?? "low").toLowerCase();
  const cls = SEV_STYLES[key] ?? "bg-content-subtle/10 text-content-subtle border-hairline";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}
    >
      {sev ?? "n/d"}
    </span>
  );
}

type Filters = {
  projectId: string; // "" = all
  severity: SevKey; // "all" = all
  indexCode: string; // "" = all
  from: string; // yyyy-mm-dd
  to: string;
};

const emptyFilters: Filters = {
  projectId: "",
  severity: "all",
  indexCode: "",
  from: "",
  to: "",
};

function SatelitalPage() {
  const search = Route.useSearch();
  const fetchSat = useServerFn(getPublicSatellite);
  const { data, isError, refetch } = useQuery({
    queryKey: ["public-satellite"],
    queryFn: () => fetchSat(),
    staleTime: 60_000,
  });
  const projects = useMemo<PublicSatProject[]>(() => data ?? [], [data]);

  const [filters, setFilters] = useState<Filters>(() => ({
    ...emptyFilters,
    projectId: search.project ?? "",
  }));

  const indexCodes = useMemo(() => {
    const s = new Set<string>();
    projects.forEach((p) => p.anomalies.forEach((a) => a.index_code && s.add(a.index_code)));
    return Array.from(s).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const from = filters.from ? new Date(filters.from).getTime() : null;
    const to = filters.to ? new Date(filters.to).getTime() + 86_400_000 : null;

    return projects
      .filter((p) => (filters.projectId ? p.id === filters.projectId : true))
      .map((p) => {
        const anomalies = p.anomalies.filter((a) => {
          if (filters.severity !== "all" && (a.severity ?? "").toLowerCase() !== filters.severity)
            return false;
          if (filters.indexCode && a.index_code !== filters.indexCode) return false;
          if (from && a.detected_at && new Date(a.detected_at).getTime() < from) return false;
          if (to && a.detected_at && new Date(a.detected_at).getTime() > to) return false;
          return true;
        });
        const insar = p.insar.filter((i) => {
          if (
            filters.severity !== "all" &&
            (i.alert_severity ?? "").toLowerCase() !== filters.severity
          )
            return false;
          const d = i.reference_date ?? i.end_date;
          if (from && d && new Date(d).getTime() < from) return false;
          if (to && d && new Date(d).getTime() > to) return false;
          return true;
        });
        return { ...p, anomalies, insar };
      });
  }, [projects, filters]);

  const totalAnomalies = filteredProjects.reduce((s, p) => s + p.anomalies.length, 0);
  const totalInsar = filteredProjects.reduce((s, p) => s + p.insar.length, 0);
  const criticalCount = filteredProjects.reduce(
    (s, p) => s + p.anomalies.filter((a) => (a.severity ?? "").toLowerCase() === "critical").length,
    0,
  );

  const active =
    filters.projectId ||
    filters.severity !== "all" ||
    filters.indexCode ||
    filters.from ||
    filters.to;

  return (
    <main className="min-h-screen bg-surface">
      <MarketingHeader />

      <section className="border-b border-hairline bg-accent-brand-subtle">
        <div className="max-w-7xl mx-auto px-5 py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <Eyebrow className="mb-3 inline-flex items-center gap-1.5">
            <Satellite className="w-3.5 h-3.5" /> Monitoreo satelital
          </Eyebrow>
          <h1 className="brand-display text-4xl md:text-5xl text-content mt-3 mb-4 max-w-3xl leading-tight">
            Anomalías multiespectrales y deformación InSAR en tiempo casi real
          </h1>
          <p className="text-content-subtle text-lg max-w-2xl">
            Geocapitals procesa Sentinel-1/2 y Copernicus sobre tu portafolio minero para detectar
            cambios superficiales, subsidencia y firmas espectrales asociadas a mineralización.
            Filtra por proyecto, tipo o fecha para ver detalles.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 max-w-3xl">
            <StatBox icon={MapPin} label="Proyectos" value={filteredProjects.length} />
            <StatBox icon={AlertTriangle} label="Anomalías" value={totalAnomalies} />
            <StatBox icon={AlertTriangle} label="Críticas" value={criticalCount} tone="danger" />
            <StatBox icon={Activity} label="Puntos InSAR" value={totalInsar} />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 py-10">
        {isError && (
          <QueryError
            className="mb-8"
            message="No pudimos cargar la inteligencia satelital."
            onRetry={() => void refetch()}
          />
        )}
        <div className="rounded-xl border border-hairline bg-surface p-4 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-accent-brand" />
            <span className="text-xs font-medium uppercase tracking-wide text-content-subtle">
              Filtros
            </span>
            {active && (
              <button
                onClick={() => setFilters(emptyFilters)}
                className="ml-auto inline-flex items-center gap-1 text-xs text-content-subtle hover:text-content"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <FilterField label="Proyecto">
              <select
                value={filters.projectId}
                onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full text-sm rounded-md border border-hairline bg-surface px-2 py-1.5"
              >
                <option value="">Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Severidad">
              <select
                value={filters.severity}
                onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value as SevKey }))}
                className="w-full text-sm rounded-md border border-hairline bg-surface px-2 py-1.5"
              >
                <option value="all">Todas</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Índice / Tipo">
              <select
                value={filters.indexCode}
                onChange={(e) => setFilters((f) => ({ ...f, indexCode: e.target.value }))}
                className="w-full text-sm rounded-md border border-hairline bg-surface px-2 py-1.5"
              >
                <option value="">Todos</option>
                {indexCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Desde">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="w-full text-sm rounded-md border border-hairline bg-surface px-2 py-1.5"
              />
            </FilterField>
            <FilterField label="Hasta">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="w-full text-sm rounded-md border border-hairline bg-surface px-2 py-1.5"
              />
            </FilterField>
          </div>
        </div>

        <SectionHeading
          eyebrow="Proyectos monitoreados"
          title="Radar activo sobre cada activo"
          description="Expande cada fila para ver metadatos completos de la anomalía o adquisición InSAR."
          className="mb-8"
        />

        <div className="space-y-6">
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-content-subtle italic text-center py-10">
              No hay resultados con los filtros aplicados.
            </p>
          ) : (
            filteredProjects.map((p) => <ProjectPanel key={p.id} project={p} />)
          )}
        </div>
      </section>

      <section className="border-t border-hairline bg-accent-brand-subtle">
        <div className="max-w-4xl mx-auto px-5 py-16 text-center">
          <h2 className="brand-display text-3xl text-content mb-3">
            ¿Quieres este monitoreo sobre tu portafolio?
          </h2>
          <p className="text-content-subtle mb-6 max-w-2xl mx-auto">
            Conecta tus concesiones y activamos ingest Sentinel, InSAR y detección de anomalías con
            alertas trazables y evidencia lista para NI 43-101.
          </p>
          <Link
            to="/contacto"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-brand text-white text-sm font-medium hover:opacity-90"
          >
            Solicitar acceso <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-content-subtle mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof MapPin;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <Icon
        className={`w-4 h-4 mb-2 ${tone === "danger" ? "text-red-500" : "text-accent-brand"}`}
        strokeWidth={1.75}
      />
      <div className="font-display text-2xl text-content">{value}</div>
      <div className="text-xs text-content-subtle mt-0.5">{label}</div>
    </div>
  );
}

const SEV_HEX: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

/** Distribución de severidades como barra apilada horizontal. */
function SeverityDistribution({ anomalies }: { anomalies: PublicSatProject["anomalies"] }) {
  const counts = SEVERITIES.map((sev) => ({
    sev,
    n: anomalies.filter((a) => (a.severity ?? "").toLowerCase() === sev).length,
  })).filter((c) => c.n > 0);
  const total = counts.reduce((s, c) => s + c.n, 0);
  if (total === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex h-2 rounded-full overflow-hidden border border-hairline">
        {counts.map((c) => (
          <div
            key={c.sev}
            style={{ width: `${(c.n / total) * 100}%`, background: SEV_HEX[c.sev] }}
            title={`${c.sev}: ${c.n}`}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-1.5 flex-wrap">
        {counts.map((c) => (
          <span
            key={c.sev}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono text-content-subtle"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: SEV_HEX[c.sev] }} />
            {c.sev} · {c.n}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Velocidades InSAR como barras firmadas (subsidencia negativa / alzamiento positivo). */
function InsarVelocityChart({ insar }: { insar: PublicSatProject["insar"] }) {
  const pts = insar
    .filter((i) => i.velocity_mm_year != null)
    .slice(0, 24)
    .map((i) => ({ id: i.id, v: Number(i.velocity_mm_year), sev: i.alert_severity }));
  if (pts.length < 2) return null;

  const W = 400;
  const H = 72;
  const maxAbs = Math.max(...pts.map((p) => Math.abs(p.v)), 1);
  const colW = W / pts.length;
  const barW = Math.max(3, colW * 0.62);
  const zeroY = H / 2;

  return (
    <div className="mb-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-1.5">
        Velocidad InSAR por punto (mm/año)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Velocidades InSAR">
        <line
          x1="0"
          x2={W}
          y1={zeroY}
          y2={zeroY}
          style={{ stroke: "var(--hairline-strong)" }}
          strokeWidth="1"
        />
        {pts.map((p, i) => {
          const h = Math.max(1.5, (Math.abs(p.v) / maxAbs) * (H / 2 - 4));
          const y = p.v >= 0 ? zeroY - h : zeroY;
          const sev = (p.sev ?? "low").toLowerCase();
          return (
            <rect
              key={p.id}
              className="chart-bar"
              x={i * colW + (colW - barW) / 2}
              y={y}
              width={barW}
              height={h}
              rx="1"
              fill={SEV_HEX[sev] ?? "#94a3b8"}
              opacity="0.85"
              style={{
                transformOrigin: `${i * colW + colW / 2}px ${zeroY}px`,
                animationDelay: `${Math.min(i, 16) * 35}ms`,
              }}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-content-subtle mt-0.5">
        <span>↑ alzamiento</span>
        <span>máx |{maxAbs.toFixed(1)}| mm/a</span>
        <span>↓ subsidencia</span>
      </div>
    </div>
  );
}

/** Serie temporal de desplazamiento acumulado (línea sobre fechas de referencia). */
function InsarTimeSeriesChart({ insar }: { insar: PublicSatProject["insar"] }) {
  const pts = insar
    .filter((i) => i.reference_date && i.cumulative_displacement_mm != null)
    .map((i) => ({
      t: new Date(i.reference_date!).getTime(),
      v: Number(i.cumulative_displacement_mm),
    }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 3) return null;

  const W = 400;
  const H = 80;
  const PAD = 6;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const spanT = Math.max(t1 - t0, 1);
  const vMin = Math.min(...pts.map((p) => p.v), 0);
  const vMax = Math.max(...pts.map((p) => p.v), 0);
  const spanV = Math.max(vMax - vMin, 1);

  const px = (t: number) => PAD + ((t - t0) / spanT) * (W - PAD * 2);
  const py = (v: number) => PAD + (1 - (v - vMin) / spanV) * (H - PAD * 2);
  const poly = pts.map((p) => `${px(p.t).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");
  const zeroY = py(0);
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });

  return (
    <div className="mb-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-1.5">
        Desplazamiento acumulado (mm) · serie temporal
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Serie temporal de desplazamiento acumulado"
      >
        {zeroY >= PAD && zeroY <= H - PAD && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={zeroY}
            y2={zeroY}
            style={{ stroke: "var(--hairline-strong)" }}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        <polyline
          className="chart-line"
          pathLength={1}
          points={poly}
          fill="none"
          style={{ stroke: "var(--accent-brand)" }}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            className="chart-fade"
            cx={px(p.t)}
            cy={py(p.v)}
            r="2"
            style={{ fill: "var(--accent-brand)", animationDelay: `${300 + i * 40}ms` }}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-content-subtle mt-0.5">
        <span>{fmtDate(t0)}</span>
        <span>
          {vMin.toFixed(0)} a {vMax.toFixed(0)} mm
        </span>
        <span>{fmtDate(t1)}</span>
      </div>
    </div>
  );
}

function ProjectPanel({ project }: { project: PublicSatProject }) {
  const [open, setOpen] = useState(true);
  const insarAvgVelocity =
    project.insar.length > 0
      ? project.insar.reduce((s, i) => s + (Number(i.velocity_mm_year) || 0), 0) /
        project.insar.length
      : null;
  const maxDisp = project.insar.reduce(
    (m, i) => Math.max(m, Math.abs(Number(i.cumulative_displacement_mm) || 0)),
    0,
  );

  return (
    <BrandCard>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 mb-4 flex-wrap text-left"
      >
        <div className="flex items-start gap-2">
          {open ? (
            <ChevronDown className="w-5 h-5 mt-1 text-content-subtle" />
          ) : (
            <ChevronRight className="w-5 h-5 mt-1 text-content-subtle" />
          )}
          <div>
            <div className="flex items-center gap-2 text-xs text-content-subtle mb-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>{project.country ?? "Chile"}</span>
              {project.region && <span>· {project.region}</span>}
              {project.commodity && <span>· {project.commodity}</span>}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="brand-display text-2xl text-content">{project.name}</h3>
              <VerificationBadge level={projectVerification(project.id)} linked={false} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <MiniStat label="Anomalías" value={project.anomalies.length} />
          <MiniStat label="InSAR pts" value={project.insar.length} />
          {insarAvgVelocity !== null && (
            <MiniStat label="Vel. media" value={`${insarAvgVelocity.toFixed(1)} mm/y`} />
          )}
          {maxDisp > 0 && <MiniStat label="Máx. desp." value={`${maxDisp.toFixed(0)} mm`} />}
        </div>
      </button>

      {open && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Link
            to="/visor-3d"
            search={{ project: project.id }}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-accent-brand text-accent-brand hover:bg-accent-brand-subtle transition"
          >
            <BoxIcon className="w-3 h-3" /> Ver sitio en 3D
          </Link>
          {project.listing_id && (
            <Link
              to="/proyectos/$listingId"
              params={{ listingId: project.listing_id }}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-hairline text-content-subtle hover:border-accent-brand hover:text-accent-brand transition"
            >
              <ArrowRight className="w-3 h-3" /> Ficha de inversión
            </Link>
          )}
        </div>
      )}

      {open && (
        <SatAnomalyMiniMap
          center={
            project.center_lng != null && project.center_lat != null
              ? [project.center_lng, project.center_lat]
              : null
          }
          anomalies={project.anomalies}
        />
      )}

      {open && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium text-content-subtle uppercase tracking-wide mb-3">
              Anomalías ({project.anomalies.length})
            </div>
            <SeverityDistribution anomalies={project.anomalies} />
            {project.anomalies.length === 0 ? (
              <p className="text-sm text-content-subtle italic">Sin resultados.</p>
            ) : (
              <div className="border border-hairline rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-accent-brand-subtle/50 text-xs uppercase tracking-wide text-content-subtle">
                    <tr>
                      <th className="w-8" />
                      <th className="text-left px-3 py-2">Índice</th>
                      <th className="text-left px-3 py-2">Severidad</th>
                      <th className="text-right px-3 py-2">Score</th>
                      <th className="text-right px-3 py-2">Área</th>
                      <th className="text-left px-3 py-2">Detectado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.anomalies.map((a) => (
                      <AnomalyRow key={a.id} a={a} projectId={project.id} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-content-subtle uppercase tracking-wide mb-3">
              InSAR ({project.insar.length})
            </div>
            <InsarVelocityChart insar={project.insar} />
            <InsarTimeSeriesChart insar={project.insar} />
            {project.insar.length === 0 ? (
              <p className="text-sm text-content-subtle italic">Sin resultados.</p>
            ) : (
              <div className="border border-hairline rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-accent-brand-subtle/50 text-xs uppercase tracking-wide text-content-subtle">
                    <tr>
                      <th className="w-8" />
                      <th className="text-left px-3 py-2">Asset</th>
                      <th className="text-left px-3 py-2">Fuente</th>
                      <th className="text-right px-3 py-2">Vel. mm/y</th>
                      <th className="text-right px-3 py-2">Coh.</th>
                      <th className="text-left px-3 py-2">Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.insar.map((i) => (
                      <InsarRow key={i.id} i={i} projectId={project.id} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </BrandCard>
  );
}

function AnomalyRow({
  a,
  projectId,
}: {
  a: PublicSatProject["anomalies"][number];
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-hairline cursor-pointer hover:bg-accent-brand-subtle/30"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-2 text-center text-content-subtle">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 inline" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 inline" />
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs">{a.index_code ?? "—"}</td>
        <td className="px-3 py-2">{sevBadge(a.severity)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {a.score != null ? Number(a.score).toFixed(2) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {a.area_ha != null ? `${Number(a.area_ha).toFixed(1)} ha` : "—"}
        </td>
        <td className="px-3 py-2 text-xs text-content-subtle">
          {a.detected_at ? new Date(a.detected_at).toLocaleDateString("es-CL") : "—"}
        </td>
      </tr>
      {open && (
        <tr className="bg-accent-brand-subtle/20 border-t border-hairline">
          <td />
          <td colSpan={5} className="px-3 py-3 text-xs text-content-subtle space-y-1.5">
            <DetailRow label="ID" value={<span className="font-mono">{a.id}</span>} />
            <DetailRow label="Índice" value={a.index_code ?? "—"} />
            <DetailRow label="Severidad" value={a.severity ?? "—"} />
            <DetailRow label="Score" value={a.score != null ? Number(a.score).toFixed(4) : "—"} />
            <DetailRow
              label="Área"
              value={a.area_ha != null ? `${Number(a.area_ha).toFixed(2)} ha` : "—"}
            />
            <DetailRow
              label="Detectado"
              value={a.detected_at ? new Date(a.detected_at).toLocaleString("es-CL") : "—"}
            />
            {a.notes && <DetailRow label="Notas" value={a.notes} />}
            <div className="pt-2">
              <Link
                to="/visor-3d"
                search={{ project: projectId, anomaly: a.id }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-accent-brand text-accent-brand hover:bg-accent-brand-subtle transition"
              >
                <BoxIcon className="w-3 h-3" /> Ver en 3D
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InsarRow({ i, projectId }: { i: PublicSatProject["insar"][number]; projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-hairline cursor-pointer hover:bg-accent-brand-subtle/30"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-2 text-center text-content-subtle">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 inline" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 inline" />
          )}
        </td>
        <td className="px-3 py-2 text-xs">{i.asset_name ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-content-subtle">{i.source ?? "—"}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {i.velocity_mm_year != null ? Number(i.velocity_mm_year).toFixed(1) : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {i.coherence != null ? Number(i.coherence).toFixed(2) : "—"}
        </td>
        <td className="px-3 py-2">{sevBadge(i.alert_severity)}</td>
      </tr>
      {open && (
        <tr className="bg-accent-brand-subtle/20 border-t border-hairline">
          <td />
          <td colSpan={5} className="px-3 py-3 text-xs text-content-subtle space-y-1.5">
            <DetailRow label="ID" value={<span className="font-mono">{i.id}</span>} />
            <DetailRow label="Asset" value={i.asset_name ?? "—"} />
            <DetailRow label="Fuente" value={i.source ?? "—"} />
            <DetailRow
              label="Fecha ref."
              value={
                i.reference_date ? new Date(i.reference_date).toLocaleDateString("es-CL") : "—"
              }
            />
            <DetailRow
              label="Fecha fin"
              value={i.end_date ? new Date(i.end_date).toLocaleDateString("es-CL") : "—"}
            />
            <DetailRow
              label="Velocidad"
              value={
                i.velocity_mm_year != null ? `${Number(i.velocity_mm_year).toFixed(2)} mm/y` : "—"
              }
            />
            <DetailRow
              label="Desp. acumulado"
              value={
                i.cumulative_displacement_mm != null
                  ? `${Number(i.cumulative_displacement_mm).toFixed(1)} mm`
                  : "—"
              }
            />
            <DetailRow
              label="Coherencia"
              value={i.coherence != null ? Number(i.coherence).toFixed(3) : "—"}
            />
            <DetailRow label="Alerta" value={i.alert_severity ?? "—"} />
            <div className="pt-2">
              <Link
                to="/visor-3d"
                search={{ project: projectId, insar: i.id }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-accent-brand text-accent-brand hover:bg-accent-brand-subtle transition"
              >
                <BoxIcon className="w-3 h-3" /> Ver en 3D
              </Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 uppercase tracking-wide text-[10px] text-content-subtle/80 pt-0.5">
        {label}
      </span>
      <span className="text-content">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-hairline px-3 py-1.5">
      <div className="font-display text-sm text-content tabular-nums">{value}</div>
      <div className="text-[10px] text-content-subtle uppercase tracking-wide">{label}</div>
    </div>
  );
}
