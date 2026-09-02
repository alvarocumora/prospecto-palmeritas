import { useState } from "react";
import { CHOLQUI_ASSUMPTIONS, CHOLQUI_SCENARIOS, fmtClpM } from "../data/cholqui";

export function CholquiScenariosPanel() {
  const [grade, setGrade] = useState(CHOLQUI_SCENARIOS[0].grade);
  const active = CHOLQUI_SCENARIOS.find((s) => s.grade === grade) ?? CHOLQUI_SCENARIOS[0];
  const maxMargin = Math.max(...CHOLQUI_SCENARIOS.map((s) => s.marginClp));

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
          Economía preliminar · ilustrativa
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">
          Sensibilidad a la ley de cobre soluble
        </h2>
        <p className="text-sm text-content-subtle mt-1 max-w-3xl">
          Venta de mineral oxidado a ENAMI sobre el plan entregado de 166.500 t en 24 meses. Los
          escenarios comparten el mismo plan minero y costos: sólo cambia la tarifa por ley de cobre
          soluble (Circular ENAMI N°27, julio 2026). El caso efectivamente modelado es 1,5 %.
        </p>
      </header>

      <div className="px-6 py-5 flex flex-wrap gap-2">
        {CHOLQUI_SCENARIOS.map((s) => (
          <button
            key={s.grade}
            type="button"
            onClick={() => setGrade(s.grade)}
            className={`px-4 py-2 rounded-full text-sm font-mono border transition-colors ${
              s.grade === grade
                ? "bg-accent-brand text-accent-brand-contrast border-transparent"
                : "border-hairline text-content-muted hover:border-accent-brand"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-y border-hairline bg-surface-2">
        {(
          [
            ["Ingresos brutos", fmtClpM(active.revenueClp)],
            ["Costos operacionales", fmtClpM(active.costClp)],
            ["Superávit operacional", fmtClpM(active.marginClp)],
            [
              "Equilibrio acumulado",
              active.paybackMonth ? `Mes ${active.paybackMonth}` : "No modelado en la fuente",
            ],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              {k}
            </div>
            <div className="mt-1 text-lg font-display text-content">{v}</div>
          </div>
        ))}
      </div>

      <div className="px-6 py-6 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
          Margen acumulado no descontado por escenario
        </div>
        {CHOLQUI_SCENARIOS.map((s) => (
          <div key={s.grade} className="flex items-center gap-3">
            <span className="w-16 text-xs font-mono text-content-muted">{s.label}</span>
            <div className="flex-1 h-4 bg-surface-2 rounded-sm overflow-hidden">
              <div
                className={s.grade === grade ? "h-full bg-accent-brand" : "h-full bg-content/25"}
                style={{ width: `${(s.marginUsd / maxMargin) * 100}%` }}
              />
            </div>
            <span className="w-24 text-right text-xs font-mono text-content-muted">
              {fmtUsdM(s.marginUsd)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-6 pb-6">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
          Supuestos comunes a los cuatro escenarios
        </div>
        <dl className="grid md:grid-cols-2 gap-x-8">
          {CHOLQUI_ASSUMPTIONS.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2 border-b border-hairline">
              <dt className="text-xs text-content-subtle">{k}</dt>
              <dd className="text-xs text-content text-right max-w-[60%]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
