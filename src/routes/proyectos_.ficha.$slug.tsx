import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Radio,
  FileText,
  ShieldCheck,
  TrendingUp,
  Landmark,
  CalendarClock,
  PieChart,
} from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { Eyebrow, BrandButton } from "@/components/brand";
import { getFicha, simulateInvestment, fmtUsd0 } from "@/lib/investor/fichas";

// Ficha de inversión — la vista "inversionista" de cada proyecto showcase:
// estado, valorización, ticket de entrada, ROI por escenario y simulador.
// El live map técnico queda como profundización, no como aterrizaje.

export const Route = createFileRoute("/proyectos_/ficha/$slug")({
  head: ({ params }) => {
    const f = getFicha(params.slug);
    return {
      meta: [
        { title: `${f?.name ?? "Proyecto"} · Ficha de inversión — Geocapitals` },
        {
          name: "description",
          content: f
            ? `${f.name} (${f.commodity}) — etapa, valorización referencial, ticket desde ${fmtUsd0(f.minTicketUsd)} y simulación de inversión.`
            : "Ficha de inversión de proyecto minero.",
        },
      ],
    };
  },
  component: FichaPage,
});

function FichaPage() {
  const { slug } = Route.useParams();
  const ficha = getFicha(slug);

  if (!ficha) {
    return (
      <MarketingPage eyebrow="Proyectos" title="Ficha no encontrada">
        <p className="text-content-subtle text-sm">
          Este proyecto no tiene ficha de inversión publicada.
        </p>
        <Link
          to="/proyectos"
          className="mt-4 inline-flex items-center gap-1.5 text-accent-brand text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a proyectos
        </Link>
      </MarketingPage>
    );
  }
  return <FichaBody key={ficha.slug} />;
}

function FichaBody() {
  const { slug } = Route.useParams();
  const ficha = getFicha(slug)!;
  const [amount, setAmount] = useState(() => Math.min(ficha.minTicketUsd * 2, ficha.roundSizeUsd));
  const sim = simulateInvestment(ficha, amount);

  return (
    <MarketingPage
      eyebrow={`Ficha de inversión · ${ficha.code}`}
      title={ficha.name}
      intro={`${ficha.region}, ${ficha.country} · ${ficha.commodity} · ${ficha.stage}`}
    >
      <Link
        to="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-accent-brand -mt-8 mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Todos los proyectos
      </Link>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        {/* Estado del proyecto */}
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
          <div className="mt-5 pt-4 border-t border-hairline flex flex-wrap gap-3 text-sm">
            <Link
              to={ficha.liveTo}
              className="inline-flex items-center gap-1.5 text-accent-brand hover:underline"
            >
              <Radio className="w-4 h-4" /> Live map técnico
            </Link>
            {ficha.reportTo && (
              <Link
                to={ficha.reportTo}
                className="inline-flex items-center gap-1.5 text-accent-brand hover:underline"
              >
                <FileText className="w-4 h-4" /> Informe pre-NI 43-101
              </Link>
            )}
          </div>
        </section>

        {/* Términos */}
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

      {/* Simulador */}
      <section className="mt-6 rounded-2xl border border-hairline bg-white p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-accent-brand" />
          <Eyebrow>Simulador de inversión</Eyebrow>
        </div>
        <p className="text-sm text-content-subtle mb-5">
          Mueve el monto y mira participación estimada y retorno por escenario a{" "}
          {ficha.horizonYears} años.
        </p>

        <div className="grid md:grid-cols-[280px_1fr] gap-8 items-start">
          <div>
            <label className="block text-xs text-content-subtle mb-1">Monto a invertir</label>
            <input
              type="range"
              min={ficha.minTicketUsd}
              max={ficha.roundSizeUsd}
              step={5000}
              value={sim.amountUsd}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-[var(--im-cobalt,#0b2a5b)]"
            />
            <div className="mt-2 font-mono text-2xl text-content">{fmtUsd0(sim.amountUsd)}</div>
            <div className="mt-3 rounded-lg bg-accent-brand-subtle px-4 py-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand">
                Participación estimada
              </div>
              <div className="font-mono text-xl text-content mt-0.5">
                {sim.sharePct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-content-subtle">
                del vehículo, con la ronda completa colocada
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-content-subtle border-b border-hairline">
                  <th className="py-2 pr-3">Escenario</th>
                  <th className="py-2 pr-3">Múltiplo</th>
                  <th className="py-2 pr-3">Valor estimado</th>
                  <th className="py-2 pr-3">Utilidad</th>
                  <th className="py-2 pr-3">ROI</th>
                  <th className="py-2">TIR aprox.</th>
                </tr>
              </thead>
              <tbody>
                {sim.rows.map((r) => (
                  <tr key={r.key} className="border-b border-hairline/60 align-top">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-content">{r.label}</span>
                      <span className="block text-[11px] text-content-subtle max-w-[220px]">
                        {r.note}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{r.multiple.toFixed(1)}×</td>
                    <td className="py-2.5 pr-3 font-mono">{fmtUsd0(r.grossUsd)}</td>
                    <td className="py-2.5 pr-3 font-mono text-accent-brand">
                      {fmtUsd0(r.profitUsd)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{Math.round(r.roiPct)}%</td>
                    <td className="py-2.5 font-mono">{r.irrApproxPct.toFixed(1)}% anual</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-content-subtle">
          Simulación ilustrativa sobre escenarios definidos por el equipo — no es una proyección
          garantizada ni asesoría financiera. La minería de exploración implica riesgo de pérdida
          total del capital.
        </p>
      </section>

      {/* Uso de fondos + hitos */}
      <div className="mt-6 grid lg:grid-cols-2 gap-6 items-start">
        <section className="rounded-2xl border border-hairline bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-accent-brand" />
            <Eyebrow>Uso de fondos</Eyebrow>
          </div>
          <div className="space-y-3">
            {ficha.useOfFunds.map((u) => (
              <div key={u.label}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="text-content">{u.label}</span>
                  <span className="font-mono text-content-subtle">{u.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-accent-brand-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-brand"
                    style={{ width: `${u.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-hairline bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4 text-accent-brand" />
            <Eyebrow>Próximos hitos</Eyebrow>
          </div>
          <ol className="relative border-l border-hairline ml-1.5 space-y-4">
            {ficha.milestones.map((m) => (
              <li key={`${m.when}-${m.what}`} className="ml-4">
                <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-accent-brand" />
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand">
                  {m.when}
                </div>
                <div className="text-sm text-content">{m.what}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* CTA */}
      <section className="mt-10 rounded-2xl bg-surface-inverse text-white p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <h2 className="brand-display text-2xl">¿Quieres avanzar con {ficha.name}?</h2>
          <p className="mt-2 text-white/70 max-w-xl text-sm">
            Firma el NDA y accede al data room completo: catastro, sondajes, satélite y modelo
            económico. El equipo te acompaña en el proceso de due diligence.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <BrandButton asChild>
            <Link to="/contacto">
              Solicitar data room <ArrowRight className="w-4 h-4" />
            </Link>
          </BrandButton>
          <Link
            to="/inversionistas"
            className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-5 py-3 rounded-md text-sm hover:bg-white/10"
          >
            Portal de inversionistas
          </Link>
        </div>
      </section>
    </MarketingPage>
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
