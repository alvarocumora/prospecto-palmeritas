import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Satellite, Activity, AlertTriangle, MapPin, ArrowLeft, ArrowRight, Radio } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { BrandCard, Eyebrow, SectionHeading } from "@/components/brand";
import { getPublicSatellite, type PublicSatProject } from "@/lib/publicSatellite.functions";

export const Route = createFileRoute("/satelital")({
  head: () => ({
    meta: [
      { title: "Monitoreo satelital minero — Geocapitals" },
      {
        name: "description",
        content:
          "Detección de anomalías multiespectrales y deformación InSAR sobre proyectos mineros demo en Chile. Datos Sentinel y Copernicus procesados en Geocapitals Terminal.",
      },
      { property: "og:title", content: "Monitoreo satelital minero — Geocapitals" },
      {
        property: "og:description",
        content:
          "Anomalías satelitales, InSAR y series temporales sobre 3 proyectos mineros chilenos.",
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

function SatelitalError({ error }: { error: Error }) {
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

function sevBadge(sev: string | null) {
  const key = (sev ?? "low").toLowerCase();
  const cls = SEV_STYLES[key] ?? "bg-content-subtle/10 text-content-subtle border-hairline";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {sev ?? "n/d"}
    </span>
  );
}

function SatelitalPage() {
  const fetchSat = useServerFn(getPublicSatellite);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-satellite"],
    queryFn: () => fetchSat(),
    staleTime: 60_000,
  });
  const projects: PublicSatProject[] = data ?? [];

  const totalAnomalies = projects.reduce((s, p) => s + p.anomalies.length, 0);
  const totalInsar = projects.reduce((s, p) => s + p.insar.length, 0);
  const criticalCount = projects.reduce(
    (s, p) => s + p.anomalies.filter((a) => (a.severity ?? "").toLowerCase() === "critical").length,
    0,
  );

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
            Geocapitals procesa Sentinel-1/2 y Copernicus sobre tu portafolio minero para detectar cambios
            superficiales, subsidencia y firmas espectrales asociadas a mineralización. Estos son 3 proyectos
            demo abiertos al público.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 max-w-3xl">
            <StatBox icon={MapPin} label="Proyectos demo" value={projects.length} />
            <StatBox icon={AlertTriangle} label="Anomalías" value={totalAnomalies} />
            <StatBox icon={AlertTriangle} label="Críticas" value={criticalCount} tone="danger" />
            <StatBox icon={Activity} label="Puntos InSAR" value={totalInsar} />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 py-16">
        <SectionHeading
          eyebrow="Proyectos monitoreados"
          title="Radar activo sobre cada activo"
          description="Cada proyecto agrega su propio pipeline de detección satelital, series temporales InSAR y evidencia georreferenciada."
          className="mb-10"
        />

        <div className="space-y-8">
          {projects.map((p) => (
            <ProjectPanel key={p.id} project={p} />
          ))}
        </div>
      </section>

      <section className="border-t border-hairline bg-accent-brand-subtle">
        <div className="max-w-4xl mx-auto px-5 py-16 text-center">
          <h2 className="brand-display text-3xl text-content mb-3">
            ¿Quieres este monitoreo sobre tu portafolio?
          </h2>
          <p className="text-content-subtle mb-6 max-w-2xl mx-auto">
            Conecta tus concesiones y activamos ingest Sentinel, InSAR y detección de anomalías con alertas
            trazables y evidencia lista para NI 43-101.
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

function ProjectPanel({ project }: { project: PublicSatProject }) {
  const insarAvgVelocity =
    project.insar.length > 0
      ? project.insar.reduce((s, i) => s + (Number(i.velocity_mm_year) || 0), 0) / project.insar.length
      : null;
  const maxDisp = project.insar.reduce(
    (m, i) => Math.max(m, Math.abs(Number(i.cumulative_displacement_mm) || 0)),
    0,
  );

  return (
    <BrandCard>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-content-subtle mb-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>{project.country ?? "Chile"}</span>
            {project.region && <span>· {project.region}</span>}
            {project.commodity && <span>· {project.commodity}</span>}
          </div>
          <h3 className="brand-display text-2xl text-content">{project.name}</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          <MiniStat label="Anomalías" value={project.anomalies.length} />
          <MiniStat label="InSAR pts" value={project.insar.length} />
          {insarAvgVelocity !== null && (
            <MiniStat label="Vel. media" value={`${insarAvgVelocity.toFixed(1)} mm/y`} />
          )}
          {maxDisp > 0 && <MiniStat label="Máx. desp." value={`${maxDisp.toFixed(0)} mm`} />}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-medium text-content-subtle uppercase tracking-wide mb-3">
            Anomalías recientes
          </div>
          {project.anomalies.length === 0 ? (
            <p className="text-sm text-content-subtle italic">Sin anomalías detectadas.</p>
          ) : (
            <div className="border border-hairline rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-accent-brand-subtle/50 text-xs uppercase tracking-wide text-content-subtle">
                  <tr>
                    <th className="text-left px-3 py-2">Índice</th>
                    <th className="text-left px-3 py-2">Severidad</th>
                    <th className="text-right px-3 py-2">Score</th>
                    <th className="text-right px-3 py-2">Área (ha)</th>
                    <th className="text-left px-3 py-2">Detectado</th>
                  </tr>
                </thead>
                <tbody>
                  {project.anomalies.slice(0, 8).map((a) => (
                    <tr key={a.id} className="border-t border-hairline">
                      <td className="px-3 py-2 font-mono text-xs">{a.index_code ?? "—"}</td>
                      <td className="px-3 py-2">{sevBadge(a.severity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.score != null ? Number(a.score).toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.area_ha != null ? Number(a.area_ha).toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-content-subtle">
                        {a.detected_at ? new Date(a.detected_at).toLocaleDateString("es-CL") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {project.anomalies.length > 8 && (
                <div className="px-3 py-2 text-xs text-content-subtle bg-accent-brand-subtle/30">
                  +{project.anomalies.length - 8} anomalías adicionales
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-content-subtle uppercase tracking-wide mb-3">
            InSAR (deformación superficial)
          </div>
          {project.insar.length === 0 ? (
            <p className="text-sm text-content-subtle italic">
              Sin adquisiciones InSAR publicadas para este proyecto.
            </p>
          ) : (
            <div className="border border-hairline rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-accent-brand-subtle/50 text-xs uppercase tracking-wide text-content-subtle">
                  <tr>
                    <th className="text-left px-3 py-2">Asset</th>
                    <th className="text-left px-3 py-2">Fuente</th>
                    <th className="text-right px-3 py-2">Vel. mm/y</th>
                    <th className="text-right px-3 py-2">Coh.</th>
                    <th className="text-left px-3 py-2">Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {project.insar.slice(0, 8).map((i) => (
                    <tr key={i.id} className="border-t border-hairline">
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
                  ))}
                </tbody>
              </table>
              {project.insar.length > 8 && (
                <div className="px-3 py-2 text-xs text-content-subtle bg-accent-brand-subtle/30">
                  +{project.insar.length - 8} adquisiciones adicionales
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BrandCard>
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
