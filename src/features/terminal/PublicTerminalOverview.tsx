import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers, MapPin } from "lucide-react";
import { TerminalSectionFrame } from "./TerminalSectionFrame";
import { listTerminalProjects } from "./terminalProjects";
import { fmtUsd0 } from "@/lib/investor/fichas";

export function PublicTerminalOverview() {
  return (
    <TerminalSectionFrame
      eyebrow="Mining investment desk"
      title="De la exploración a la inversión"
      description="Explora los activos, revisa su tesis y compara el próximo hito financiable desde un mismo terminal."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          to="/inversionistas"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 text-sm font-medium"
        >
          Oportunidades publicadas <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/auth"
          search={{ intent: "investor", next: "/dashboard" }}
          className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm"
        >
          Mi espacio de inversión
        </Link>
      </div>
      <section className="grid md:grid-cols-2 gap-5" aria-label="Terminales de proyectos">
        {listTerminalProjects().map(({ slug, ficha }) => (
          <article
            key={slug}
            className="rounded-xl border border-border bg-card/40 p-6 flex flex-col gap-5 hover:border-gold/50 transition-colors"
          >
            <div className="flex justify-between gap-3">
              <p className="text-xs font-mono uppercase tracking-wider text-gold">
                {ficha.code} · {ficha.commodity}
              </p>
              <Layers className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
            <div>
              <h2 className="font-display text-2xl">{ficha.name}</h2>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {ficha.region}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-y border-border py-4">
              <div>
                <dt className="text-[10px] font-mono uppercase text-muted-foreground">Etapa</dt>
                <dd className="text-sm mt-1">{ficha.stage}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase text-muted-foreground">
                  Ticket referencial
                </dt>
                <dd className="text-sm font-mono mt-1">{fmtUsd0(ficha.minTicketUsd)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-4 mt-auto">
              <Link
                to="/terminal/$slug"
                params={{ slug }}
                search={{ tab: "mapa" }}
                className="text-sm text-gold inline-flex items-center gap-2 hover:underline"
              >
                Mapa y exploración <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/terminal/$slug"
                params={{ slug }}
                search={{ tab: "tesis" }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Revisar tesis
              </Link>
            </div>
          </article>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">
        Los perfiles de activos son informativos. Revisa disponibilidad, riesgos y términos en cada
        oportunidad publicada.
      </p>
    </TerminalSectionFrame>
  );
}
