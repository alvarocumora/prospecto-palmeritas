import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { equitySearch, investmentAmount, investmentHref } from "@/lib/investor/investmentIntent";
import { ProjectOpportunities } from "./ProjectOpportunities";
import { TrendingUp } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { simulateInvestment, fmtUsd0, type ProjectFicha } from "@/lib/investor/fichas";

/** Simulador de ticket: monto, participación estimada y retorno por escenario. */
export function TerminalSimulator({
  ficha,
  initialAmount,
  projectId,
}: {
  ficha: ProjectFicha;
  initialAmount?: number;
  projectId?: string;
}) {
  const { user, loading } = useAuth();
  const [amount, setAmount] = useState(() =>
    String(initialAmount ?? Math.min(ficha.minTicketUsd * 2, ficha.roundSizeUsd)),
  );
  const validAmount = investmentAmount(Number(amount), ficha.roundSizeUsd);
  const belowMinimum = validAmount !== undefined && validAmount < ficha.minTicketUsd;
  const sim = validAmount && !belowMinimum ? simulateInvestment(ficha, validAmount) : null;
  const next = validAmount && investmentHref(`/terminal/${ficha.slug}`, equitySearch(validAmount));

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-accent-brand" />
        <Eyebrow>Simulador de inversión</Eyebrow>
      </div>
      <p className="text-sm text-content-subtle mb-5">
        Ingresa un monto para estimar la participación y el retorno por escenario a{" "}
        {ficha.horizonYears} años. Instrumento publicado: {ficha.instrument}.
      </p>

      <div className="grid md:grid-cols-[280px_1fr] gap-8 items-start">
        <div>
          <label className="block text-xs text-content-subtle mb-1" htmlFor="terminal-amount">
            Monto a invertir (USD)
          </label>
          <input
            id="terminal-amount"
            type="number"
            min={1}
            max={ficha.roundSizeUsd}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border border-hairline px-3 py-2 font-mono"
          />
          {belowMinimum && (
            <p className="mt-2 text-xs text-content-subtle">
              El mínimo publicado es {fmtUsd0(ficha.minTicketUsd)}. Puedes consultar por el monto
              ingresado.
            </p>
          )}
          {!validAmount && (
            <p className="mt-2 text-xs text-content-subtle">
              Ingresa un monto entero entre USD 1 y {fmtUsd0(ficha.roundSizeUsd)}.
            </p>
          )}
          {sim && (
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
          )}
        </div>

        {sim && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-content-subtle border-b border-hairline">
                  <th className="py-2 pr-3">Escenario</th>
                  <th className="py-2 pr-3">Múltiplo</th>
                  <th className="py-2 pr-3">Valor estimado</th>
                  <th className="py-2 pr-3">Utilidad</th>
                  <th className="py-2 pr-3">ROI</th>
                </tr>
              </thead>
              <tbody>
                {sim.rows.map((row) => (
                  <tr key={row.key} className="border-b border-hairline/70 align-top">
                    <td className="py-2.5 pr-3">
                      <div className="text-content font-medium">{row.label}</div>
                      <div className="text-[11px] text-content-subtle max-w-[260px]">
                        {row.note}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{row.multiple.toFixed(1)}x</td>
                    <td className="py-2.5 pr-3 font-mono">{fmtUsd0(row.grossUsd)}</td>
                    <td className="py-2.5 pr-3 font-mono">{fmtUsd0(row.profitUsd)}</td>
                    <td className="py-2.5 pr-3 font-mono">{row.roiPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && next && !user && (
        <Link
          to="/auth"
          search={{ intent: "investor", next }}
          className="mt-5 inline-flex rounded-md bg-accent-brand px-4 py-2 text-sm text-white"
        >
          Continuar con este monto
        </Link>
      )}
      {!loading && user && validAmount && (
        <div className="mt-5 space-y-4">
          <ProjectOpportunities
            projectId={projectId}
            equityAmount={validAmount}
            projectName={ficha.name}
          />
          <Link
            to="/dashboard/investments"
            search={{ vista: "wallet" }}
            className="text-sm text-accent-brand hover:underline"
          >
            Ver mi billetera
          </Link>
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-content-subtle border-t border-hairline pt-3">
        Escenarios ilustrativos sobre términos referenciales. No constituyen oferta pública, no
        incorporan recursos ni reservas certificadas y están sujetos a due diligence y acuerdo
        definitivo.
      </p>
    </section>
  );
}
