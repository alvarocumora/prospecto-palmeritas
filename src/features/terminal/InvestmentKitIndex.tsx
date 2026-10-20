import { Link } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, FileCheck2 } from "lucide-react";
import { INVESTOR_KIT_CATALOGUE } from "@/features/investor/investmentKitCatalog";
import type { TerminalProject } from "./terminalProjects";

/**
 * Navigational inventory, not a downloadable bundle and not a permissions grant.
 * Existing report exports remain in ProjectDocsMenu; private downloads must
 * be resolved by the authenticated document service per user/project/ticket.
 */
export function InvestmentKitIndex({ project }: { project: TerminalProject }) {
  return (
    <section aria-labelledby="investment-kit-heading" className="rounded-2xl border border-hairline bg-white p-4 sm:p-6">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand">
          Investor kit · {project.code}
        </p>
        <h2 id="investment-kit-heading" className="mt-1 font-serif text-2xl text-content">
          Documentación para evaluar {project.name}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content-subtle">
          Primero revisa la información pública y sus limitaciones. Los antecedentes
          confidenciales requieren permiso específico; un contrato o certificado solo
          aparece cuando existe una operación y el titular está autorizado.
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {INVESTOR_KIT_CATALOGUE.map((item) => (
          <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-hairline p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-content">{item.title}</h3>
              {item.access === "public_page" ? (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-accent-brand">
                  Consultable
                </span>
              ) : (
                <LockKeyhole aria-label="Acceso controlado" className="h-4 w-4 shrink-0 text-content-subtle" />
              )}
            </div>
            <p className="text-sm leading-relaxed text-content-subtle">{item.description}</p>
            <div className="mt-auto pt-1">
              {item.access === "public_page" && item.tab ? (
                <Link
                  to="/terminal/$slug"
                  params={{ slug: project.slug }}
                  search={{ tab: item.tab }}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  Consultar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : item.access === "requires_project_permission" ? (
                <Link
                  to="/contacto"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                >
                  Consultar requisitos <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  to="/dashboard/investments"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                >
                  Ver mis solicitudes y posiciones <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-5 border-t border-hairline pt-4 text-xs text-content-subtle">
        Este índice describe requisitos de acceso: no confirma disponibilidad,
        emisión, revisión técnica ni validación regulatoria de cada archivo.
        Los reportes públicos generables, cuando existan, aparecen más abajo.
      </p>
    </section>
  );
}
