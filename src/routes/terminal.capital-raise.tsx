import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSearch, Flag, Wallet } from "lucide-react";
import { TerminalSectionFrame } from "@/features/terminal/TerminalSectionFrame";
import { listTerminalProjects } from "@/features/terminal/terminalProjects";
import { fmtUsd0 } from "@/lib/investor/fichas";

export const Route = createFileRoute("/terminal/capital-raise")({
  head: () => ({ meta: [{ title: "Capital de exploración · Geocapitals" }] }),
  component: CapitalRaisePage,
});

function CapitalRaisePage() {
  return (
    <TerminalSectionFrame
      eyebrow="Capital de exploración"
      title="Financiar el próximo hito"
      description="Revisa la tesis, el uso de fondos y los hitos de cada activo antes de evaluar una oportunidad de inversión."
    >
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: FileSearch,
            title: "Evaluar",
            text: "Evidencias, derechos y riesgos del proyecto.",
          },
          { icon: Flag, title: "Planificar", text: "Campaña, presupuesto e hitos financiables." },
          {
            icon: Wallet,
            title: "Estructurar",
            text: "Instrumento, términos y acceso al expediente.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card/40 p-5">
            <Icon className="w-5 h-5 text-gold mb-3" />
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-2">{text}</p>
          </div>
        ))}
      </div>
      <section className="grid md:grid-cols-2 gap-4" aria-label="Proyectos para evaluación">
        {listTerminalProjects().map(({ slug, ficha }) => (
          <article key={slug} className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase text-gold">
                {ficha.commodity} · {ficha.stage}
              </p>
              <h2 className="font-display text-2xl mt-2">{ficha.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{ficha.region}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Ticket de referencia:{" "}
              <span className="text-foreground font-mono">{fmtUsd0(ficha.minTicketUsd)}</span>
            </p>
            <Link
              to="/terminal/$slug"
              params={{ slug }}
              search={{ tab: "dataroom" }}
              className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
            >
              Revisar hitos y documentos <ArrowRight className="w-4 h-4" />
            </Link>
          </article>
        ))}
      </section>
      <Link
        to="/inversionistas"
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 text-sm font-medium"
      >
        Ver oportunidades publicadas <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-xs text-muted-foreground">
        Los tickets y planes son referenciales. La disponibilidad y los términos se confirman en la
        oportunidad correspondiente.
      </p>
    </TerminalSectionFrame>
  );
}
