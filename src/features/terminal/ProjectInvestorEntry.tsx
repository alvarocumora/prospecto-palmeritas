import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Info } from "lucide-react";
import { fmtUsd0 } from "@/lib/investor/fichas";
import { spvCodeForSlug } from "@/lib/investor/rounds";
import type { TerminalProject, TerminalTabKey } from "./terminalProjects";

/** Shared investment call-to-action, scoped to the selected mining project. */
export function ProjectInvestorEntry({
  project,
  currentTab,
}: {
  project: TerminalProject;
  currentTab: TerminalTabKey;
}) {
  const canRequestTicket = spvCodeForSlug(project.slug) != null;

  return (
    <section
      aria-label="Siguiente paso para evaluar inversión"
      className="flex flex-col gap-4 rounded-xl border border-hairline bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-content-subtle">
          Evaluación de inversión · {project.code}
        </p>
        <p className="mt-1 font-serif text-lg text-content">
          {canRequestTicket ? "Evalúa antes de solicitar participación" : "Consulta la oportunidad"}
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-content-subtle">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Ticket desde {fmtUsd0(project.ficha.minTicketUsd)} (referencial). Simular no reserva
          acciones ni confirma inversión.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          to="/terminal/$slug"
          params={{ slug: project.slug }}
          search={{ tab: "simulador" }}
          aria-current={currentTab === "simulador" ? "page" : undefined}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          {canRequestTicket ? "Simular participación" : "Explorar escenarios"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/terminal/$slug"
          params={{ slug: project.slug }}
          search={{ tab: "dataroom" }}
          aria-current={currentTab === "dataroom" ? "page" : undefined}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline px-4 py-2.5 text-sm text-content hover:border-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Kit y documentos
        </Link>
      </div>
    </section>
  );
}
