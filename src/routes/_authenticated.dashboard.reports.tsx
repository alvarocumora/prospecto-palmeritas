import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  FileCheck2,
  FileText,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { REPORT_PRODUCTS, REPORTING_PRINCIPLES } from "@/lib/reports/catalog";
import { STANDARD_FRAMEWORKS } from "@/lib/reports/internationalStandards";
import { MonthlyOperationalReportPanel } from "@/features/reports/MonthlyOperationalReportPanel";
import { ReportingGovernancePanel } from "@/features/reports/ReportingGovernancePanel";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: ReportingHubPage,
});

const STATUS_LABEL = {
  available: "Disponible",
  foundation: "Base preparada",
  planned: "Planificado",
} as const;

function ReportingHubPage() {
  const { active } = useProjects();

  if (!active) {
    return <div className="p-6 text-sm text-content-subtle">Selecciona un proyecto.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand">
          <FileText className="h-4 w-4" />
          Reporting Hub · {active.code}
        </div>
        <h1 className="font-display text-3xl text-content">Sistema único de informes</h1>
        <p className="max-w-4xl text-sm leading-relaxed text-content-muted">
          Los módulos del proyecto producen evidencia; Reporting decide qué evidencia entra, cómo se
          narra y qué estándar de revisión aplica. No se generan versiones distintas del mismo
          informe desde cada pantalla.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Proyecto", active.name],
          ["Commodity", active.commodity ?? "s/d"],
          ["Región", active.region ?? "s/d"],
          ["Estado", active.status ?? "s/d"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-brand border border-hairline bg-surface-2 p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-content-subtle">
              {label}
            </div>
            <div className="mt-1 text-sm font-medium text-content">{value}</div>
          </div>
        ))}
      </section>

      <ReportingGovernancePanel />

      <section className="rounded-brand-lg border border-hairline bg-surface-3">
        <div className="border-b border-hairline px-5 py-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
            <Layers3 className="h-4 w-4 text-accent-brand" />
            Productos documentales
          </div>
          <p className="mt-1 text-xs text-content-muted">
            Un producto por audiencia y propósito. Decks y resúmenes se derivan del mismo modelo
            documental; no mantienen una verdad paralela.
          </p>
        </div>
        <div className="grid md:grid-cols-2">
          {REPORT_PRODUCTS.map((product, index) => (
            <article
              key={product.id}
              className={
                "p-5 " +
                (index % 2 === 0 ? "md:border-r " : "") +
                (index < 2 ? "border-b border-hairline" : "")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-accent-brand">
                    {product.standardLabel}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-content">{product.title}</h2>
                </div>
                <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 font-mono text-[9px] uppercase text-content-subtle">
                  {STATUS_LABEL[product.status]}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-content-muted">{product.purpose}</p>
              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-content-subtle">Audiencia</dt>
                  <dd className="text-content">{product.audience}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-content-subtle">Salida</dt>
                  <dd className="font-mono text-content">{product.output}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {Object.values(STANDARD_FRAMEWORKS).map((framework) => (
          <article
            key={framework.id}
            className="rounded-brand-lg border border-hairline bg-surface-3 p-5"
          >
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-accent-brand" />
              <div className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                Marco de revisión
              </div>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-content">{framework.name}</h2>
            <p className="mt-2 text-xs leading-relaxed text-content-muted">
              {framework.positioning}
            </p>
            <div className="mt-4 space-y-2">
              {framework.checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-xs">
                  <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-subtle" />
                  <div>
                    <span className="font-medium text-content">{item.title}</span>
                    <span className="text-content-subtle"> · {item.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-brand border border-hairline bg-surface-2 px-3 py-2 text-[11px] text-content-subtle">
              Revisión responsable: <b className="text-content">{framework.reviewerRole}</b>. El
              framework prepara evidencia y checklist; no declara cumplimiento por sí solo.
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-brand-lg border border-hairline bg-surface-3 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-brand" />
          <h2 className="font-semibold text-content">Reglas editoriales</h2>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {REPORTING_PRINCIPLES.map((principle) => (
            <div key={principle} className="flex items-start gap-2 text-xs text-content-muted">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-brand" />
              <span>{principle}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link
          to="/dashboard/ni43101"
          className="group rounded-brand-lg border border-hairline bg-surface-3 p-4 hover:border-accent-brand/50"
        >
          <div className="text-sm font-medium text-content">Workspace NI 43-101</div>
          <p className="mt-1 text-xs text-content-subtle">
            Revisión técnica, QP y estado del borrador regulatorio.
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-accent-brand">
            Abrir{" "}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          to="/dashboard/validation"
          className="group rounded-brand-lg border border-hairline bg-surface-3 p-4 hover:border-accent-brand/50"
        >
          <div className="text-sm font-medium text-content">Validación y procedencia</div>
          <p className="mt-1 text-xs text-content-subtle">
            Revisar evidencia, gaps y trazabilidad antes de emitir.
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-accent-brand">
            Abrir{" "}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <a
          href="#monthly-operational-report"
          className="group rounded-brand-lg border border-hairline bg-surface-3 p-4 hover:border-accent-brand/50"
        >
          <div className="text-sm font-medium text-content">Reporte operacional mensual</div>
          <p className="mt-1 text-xs text-content-subtle">
            KPI operativo, QA/QC, targets, costos y HSE; separado del reporte técnico.
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-accent-brand">
            Abrir{" "}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </a>
      </section>

      <section id="monthly-operational-report" className="scroll-mt-24">
        <MonthlyOperationalReportPanel />
      </section>
    </div>
  );
}
