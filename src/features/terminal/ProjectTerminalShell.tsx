import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Landmark, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { buildCholquiDoc } from "@/lib/pdf/adapters/cholqui";
import { buildLosVerdesDoc } from "@/lib/pdf/adapters/losVerdes";
import { fmtUsd0 } from "@/lib/investor/fichas";
import { TerminalSimulator } from "./TerminalSimulator";
import {
  TERMINAL_TABS,
  listTerminalProjects,
  type TerminalProject,
  type TerminalTabKey,
} from "./terminalProjects";

// Visores y paneles pesados: se cargan sólo cuando su pestaña está activa.
const CholquiMasterViewer = lazy(() =>
  import("@/features/franco/components/CholquiMasterViewer").then((m) => ({
    default: m.CholquiMasterViewer,
  })),
);
const CholquiTargetsSummary = lazy(() =>
  import("@/features/franco/components/CholquiTargetsSummary").then((m) => ({
    default: m.CholquiTargetsSummary,
  })),
);
const CholquiEvidencePanel = lazy(() =>
  import("@/features/franco/components/CholquiEvidencePanel").then((m) => ({
    default: m.CholquiEvidencePanel,
  })),
);
const CholquiScenariosPanel = lazy(() =>
  import("@/features/franco/components/CholquiScenariosPanel").then((m) => ({
    default: m.CholquiScenariosPanel,
  })),
);
const CholquiMinePlanPanel = lazy(() =>
  import("@/features/franco/components/CholquiMinePlanPanel").then((m) => ({
    default: m.CholquiMinePlanPanel,
  })),
);
const CholquiRoundPanel = lazy(() =>
  import("@/features/franco/components/CholquiRoundPanel").then((m) => ({
    default: m.CholquiRoundPanel,
  })),
);
const LosVerdesStrategicMap = lazy(() =>
  import("@/components/live/LosVerdesStrategicMap").then((m) => ({
    default: m.LosVerdesStrategicMap,
  })),
);
const TrackminGeoIntel = lazy(() =>
  import("@/features/palmeras/TrackminDashboard").then((m) => ({ default: m.TrackminGeoIntel })),
);

function Loading({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white py-20 grid place-items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-accent-brand" />
      <span className="text-xs font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
    </div>
  );
}

export function ProjectTerminalShell({
  project,
  tab,
}: {
  project: TerminalProject;
  tab: TerminalTabKey;
}) {
  const projects = listTerminalProjects();
  const { ficha } = project;

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      {/* Barra superior del terminal: selector de activo + métricas clave */}
      <header className="sticky top-0 z-30 bg-surface-inverse text-white border-b border-white/10">
        <div className="max-w-[1320px] mx-auto px-4 md:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
            <Link to="/" className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/60 hover:text-white">
              Geocapitals · Terminal
            </Link>

            <nav className="flex items-center gap-1.5">
              {projects.map((p) => (
                <Link
                  key={p.slug}
                  to="/terminal/$slug"
                  params={{ slug: p.slug }}
                  search={{ tab }}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border transition-colors ${
                    p.slug === project.slug
                      ? "bg-white text-content border-white"
                      : "border-white/25 text-white/70 hover:text-white hover:border-white/60"
                  }`}
                >
                  {p.ficha.code}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-5 text-[11px] font-mono text-white/70">
              <span>{ficha.commodity}</span>
              <span className="hidden sm:inline">{ficha.region}</span>
              <span className="hidden md:inline">Ticket {fmtUsd0(ficha.minTicketUsd)}</span>
            </div>
          </div>

          <div className="pb-3">
            <h1 className="font-display text-2xl md:text-3xl text-white">{ficha.name}</h1>
            <p className="text-[12px] text-white/60 mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {ficha.region}, {ficha.country} · {ficha.stage}
            </p>
          </div>

          {/* Pestañas ejecutivas: misma pantalla, sin recarga */}
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TERMINAL_TABS.map((t) => (
              <Link
                key={t.key}
                to="/terminal/$slug"
                params={{ slug: project.slug }}
                search={{ tab: t.key }}
                className={`whitespace-nowrap px-4 py-2.5 text-[12px] font-mono uppercase tracking-wider border-b-2 transition-colors ${
                  t.key === tab
                    ? "border-white text-white"
                    : "border-transparent text-white/55 hover:text-white"
                }`}
              >
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {tab === "mapa" && <MapaTab project={project} />}
        {tab === "tesis" && <TesisTab project={project} />}
        {tab === "simulador" && <SimuladorTab project={project} />}
        {tab === "dataroom" && <DataRoomTab project={project} />}

        <footer className="text-[11px] text-content-subtle pb-10">
          {ficha.name} ({ficha.code}) · Operado por Geocapitals. Documento informativo: no
          constituye oferta pública de valores. Sin recursos ni reservas certificadas bajo estándar
          reconocido.
        </footer>
      </main>
    </div>
  );
}

function MapaTab({ project }: { project: TerminalProject }) {
  if (project.slug === "cholqui") {
    return (
      <Suspense fallback={<Loading label="Cargando visor" />}>
        <CholquiMasterViewer />
        <div className="mt-6">
          <CholquiTargetsSummary />
        </div>
      </Suspense>
    );
  }
  if (project.slug === "losverdes") {
    return (
      <Suspense fallback={<Loading label="Cargando visor" />}>
        <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
          <LosVerdesStrategicMap height={640} />
        </div>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<Loading label="Cargando visor" />}>
      <TrackminGeoIntel />
    </Suspense>
  );
}

function TesisTab({ project }: { project: TerminalProject }) {
  const { ficha } = project;
  return (
    <>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        <section className="rounded-2xl border border-hairline bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-accent-brand" />
            <Eyebrow>Estado del proyecto</Eyebrow>
          </div>
          <span className="inline-block rounded-full bg-accent-brand-subtle text-accent-brand text-[11px] font-mono uppercase tracking-wider px-3 py-1">
            {ficha.stage}
          </span>
          <p className="mt-3 text-sm text-content leading-relaxed">{ficha.stageDetail}</p>
          <ul className="mt-4 space-y-2 text-[13px] text-content">
            {ficha.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-brand shrink-0" /> {h}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-hairline bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-4 h-4 text-accent-brand" />
            <Eyebrow>Valorización y términos</Eyebrow>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Term label="Valorización referencial">
              {fmtUsd0(ficha.valuationUsd.low)} – {fmtUsd0(ficha.valuationUsd.high)}
              <span className="block text-[11px] text-content-subtle mt-0.5">
                {ficha.valuationUsd.method}
              </span>
            </Term>
            <Term label="Ronda en levantamiento">{fmtUsd0(ficha.roundSizeUsd)}</Term>
            <Term label="Ticket mínimo">{fmtUsd0(ficha.minTicketUsd)}</Term>
            <Term label="Instrumento">{ficha.instrument}</Term>
            <Term label="Equity ofrecido (ronda completa)">{ficha.equityOfferedPct}%</Term>
            <Term label="Horizonte">{ficha.horizonYears} años</Term>
          </dl>
          <p className="mt-4 text-[11px] leading-relaxed text-content-subtle border-t border-hairline pt-3">
            Términos referenciales definidos por el equipo — no constituyen oferta pública y están
            sujetos a due diligence, NDA y acuerdo definitivo.
          </p>
        </section>
      </div>

      {project.slug === "cholqui" && (
        <Suspense fallback={<Loading label="Cargando ensayes" />}>
          <div className="mt-6">
            <CholquiEvidencePanel />
          </div>
        </Suspense>
      )}
    </>
  );
}

function SimuladorTab({ project }: { project: TerminalProject }) {
  return (
    <>
      <TerminalSimulator ficha={project.ficha} />
      {project.slug === "cholqui" && (
        <Suspense fallback={<Loading label="Cargando escenarios" />}>
          <div className="mt-6 space-y-6">
            <CholquiScenariosPanel />
            <CholquiMinePlanPanel />
          </div>
        </Suspense>
      )}
    </>
  );
}

function DataRoomTab({ project }: { project: TerminalProject }) {
  const { ficha } = project;
  return (
    <>
      <section className="rounded-2xl border border-hairline bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-accent-brand" />
          <Eyebrow>Documentos del activo</Eyebrow>
        </div>
        <p className="text-sm text-content-subtle max-w-2xl">
          Descarga el expediente con la marca de Geocapitals: presentación para comité, resumen de
          una página y brief técnico con trazabilidad de fuentes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {project.slug === "cholqui" && <ProjectDocsMenu build={() => buildCholquiDoc()} />}
          {project.slug === "losverdes" && <LosVerdesDocsMenu />}
          <Link
            to="/contacto"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-accent-brand px-5 py-2.5 text-sm text-accent-brand hover:bg-accent-brand-subtle"
          >
            Solicitar acceso al data room
          </Link>
          {ficha.reportTo && (
            <Link
              to={ficha.reportTo}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline px-5 py-2.5 text-sm text-content hover:border-accent-brand"
            >
              Informe pre-NI 43-101
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6">
        <Eyebrow>Hitos y uso de fondos</Eyebrow>
        <div className="mt-4 grid md:grid-cols-2 gap-8">
          <div className="space-y-2.5">
            {ficha.useOfFunds.map((u) => (
              <div key={u.label}>
                <div className="flex justify-between text-xs text-content-subtle">
                  <span>{u.label}</span>
                  <span className="font-mono">{u.pct}%</span>
                </div>
                <div className="h-1.5 mt-1 bg-accent-brand-subtle rounded-sm overflow-hidden">
                  <div className="h-full bg-accent-brand" style={{ width: `${u.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <ol className="space-y-3">
            {ficha.milestones.map((m) => (
              <li key={m.when} className="flex gap-3 text-sm">
                <span className="font-mono text-[11px] uppercase tracking-wider text-accent-brand w-20 shrink-0 pt-0.5">
                  {m.when}
                </span>
                <span className="text-content">{m.what}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {project.slug === "cholqui" && (
        <Suspense fallback={<Loading label="Cargando estructura" />}>
          <CholquiRoundPanel />
        </Suspense>
      )}
    </>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-content">{children}</dd>
    </div>
  );
}
