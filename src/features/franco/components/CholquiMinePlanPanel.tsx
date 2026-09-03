import { useMemo, useState } from "react";
import { CHOLQUI_SCENARIOS, fmtClp, fmtClpM } from "../data/cholqui";
import {
  CONTINGENCY_PCT,
  FIXED_COSTS,
  PLATEAU_OPTIONS,
  RATE_STEPS,
  VARIABLE_COSTS,
  fleetForRate,
  projectCashflow,
  unitCosts,
} from "../data/minePlan";

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function CholquiMinePlanPanel() {
  const [plateau, setPlateau] = useState<number>(PLATEAU_OPTIONS[0].plateau);
  const [grade, setGrade] = useState<number>(1.5);

  const plan = useMemo(
    () => projectCashflow({ plateau, gradePct: grade, startRate: 1_000, rampMonths: 12, totalMonths: 24 }),
    [plateau, grade],
  );
  const option = PLATEAU_OPTIONS.find((o) => o.plateau === plateau) ?? PLATEAU_OPTIONS[0];
  const maxRate = Math.max(...plan.months.map((m) => m.rate));
  const cashMin = Math.min(...plan.months.map((m) => m.cumulativeCashflowClp));
  const cashMax = Math.max(...plan.months.map((m) => m.cumulativeCashflowClp));
  const cashSpan = Math.max(1, cashMax - cashMin);

  const stepFleet = RATE_STEPS.map((r) => ({ rate: r, fleet: fleetForRate(r), cost: unitCosts(r) }));

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
          Plan minero · estimación de ingeniería preliminar
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">
          Escalamiento de 1.000 a {nf.format(plateau)} t/mes
        </h2>
        <p className="text-sm text-content-subtle mt-1 max-w-3xl">
          Proyección mes a mes de producción, flota, costos y venta a ENAMI partiendo de 1.000 t/mes.
          La flota se dimensiona a partir del tonelaje —no de un dato suelto— y los costos separan
          componentes variables por tonelada de costos fijos mensuales, de modo que el costo unitario
          baja al escalar. Cifras de ingeniería preliminar, no cotizaciones cerradas.
        </p>
      </header>

      <div className="px-6 py-5 flex flex-wrap items-center gap-2 border-b border-hairline">
        {PLATEAU_OPTIONS.map((o) => (
          <button
            key={o.plateau}
            type="button"
            onClick={() => setPlateau(o.plateau)}
            className={`px-4 py-2 rounded-full text-sm font-mono border transition-colors ${
              o.plateau === plateau
                ? "bg-accent-brand text-accent-brand-contrast border-transparent"
                : "border-hairline text-content-muted hover:border-accent-brand"
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-hairline" />
        {CHOLQUI_SCENARIOS.map((s) => (
          <button
            key={s.grade}
            type="button"
            onClick={() => setGrade(s.grade)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
              s.grade === grade
                ? "bg-content text-surface border-transparent"
                : "border-hairline text-content-muted hover:border-accent-brand"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-3 text-[11px] text-content-subtle border-b border-hairline">
        <span className="font-mono uppercase tracking-wider text-accent-brand">{option.tag}</span> ·{" "}
        {option.note}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
        {(
          [
            ["Mineral del ciclo", `${nf.format(plan.totalTonnes)} t / 24 meses`],
            ["Ingresos a tarifa ENAMI", fmtClpM(plan.totalRevenueClp)],
            ["Superávit operacional", fmtClpM(plan.operatingSurplusClp)],
            ["Equilibrio acumulado", plan.paybackMonth ? `Mes ${plan.paybackMonth}` : "No alcanzado en 24 meses"],
            ["Tarifa aplicada", `${fmtClp(plan.tariffClpTms)}/tms`],
            ["Costo medio del ciclo", `${fmtClp(Math.round(plan.avgUnitCostClpT))}/t`],
            ["Margen medio", `${fmtClp(Math.round(plan.marginClpT))}/t`],
            [
              "Punto de equilibrio",
              plan.breakevenRate ? `${nf.format(plan.breakevenRate)} t/mes` : "No alcanzable ≤ 30.000 t/mes",
            ],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">{k}</div>
            <div className="mt-1 text-base font-display text-content">{v}</div>
          </div>
        ))}
      </div>

      {/* Rampa de producción */}
      <div className="px-6 py-6 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Rampa de producción mensual (t/mes)
        </div>
        <div className="flex items-end gap-[3px] h-40">
          {plan.months.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col justify-end h-full" title={`Mes ${m.month}: ${nf.format(m.rate)} t`}>
              <div
                className={m.marginClp >= 0 ? "bg-accent-brand" : "bg-content/30"}
                style={{ height: `${(m.rate / maxRate) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-content-subtle mt-2">
          <span>Mes 1 · {nf.format(plan.months[0].rate)} t</span>
          <span>Mes 24 · {nf.format(plan.months[plan.months.length - 1].rate)} t</span>
        </div>
      </div>

      {/* Flujo acumulado */}
      <div className="px-6 py-6 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Flujo de caja acumulado (incluye inversión inicial {fmtClpM(plan.capexClp)})
        </div>
        <div className="flex items-end gap-[3px] h-32">
          {plan.months.map((m) => {
            const h = ((m.cumulativeCashflowClp - cashMin) / cashSpan) * 100;
            return (
              <div
                key={m.month}
                className="flex-1 flex flex-col justify-end h-full"
                title={`Mes ${m.month}: ${fmtClpM(m.cumulativeCashflowClp)}`}
              >
                <div
                  className={
                    plan.paybackMonth && m.month === plan.paybackMonth
                      ? "bg-copper"
                      : m.cumulativeCashflowClp >= 0
                        ? "bg-content"
                        : "bg-content/25"
                  }
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="text-[10px] font-mono text-content-subtle mt-2">
          {plan.paybackMonth
            ? `Equilibrio acumulado en el mes ${plan.paybackMonth}.`
            : "El flujo acumulado no cruza cero dentro del horizonte de 24 meses en este escenario."}
        </div>
      </div>

      {/* Flota por escalón */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Maquinaria requerida por escalón de producción (arriendo con operador)
        </div>
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              <th className="text-left py-2 font-mono uppercase tracking-wider text-[10px]">Equipo</th>
              {RATE_STEPS.map((r) => (
                <th key={r} className="text-right py-2 font-mono text-[10px]">
                  {nf.format(r)} t
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stepFleet[0].fleet.lines.map((line, idx) => (
              <tr key={line.spec.key} className="border-b border-hairline">
                <td className="py-2 text-content">
                  {line.spec.label}
                  <div className="text-[10px] text-content-subtle">{line.spec.note}</div>
                </td>
                {stepFleet.map((s) => (
                  <td key={s.rate} className="py-2 text-right font-mono text-content">
                    {s.fleet.lines[idx].units}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-surface-2">
              <td className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                Costo de flota (CLP/mes)
              </td>
              {stepFleet.map((s) => (
                <td key={s.rate} className="py-2 text-right font-mono text-content">
                  {fmtClpM(s.fleet.monthlyClp)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Costos unitarios */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Costo por tonelada según ritmo (CLP/t) — el fijo se diluye al escalar
        </div>
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              <th className="text-left py-2 font-mono uppercase tracking-wider text-[10px]">Componente</th>
              {RATE_STEPS.map((r) => (
                <th key={r} className="text-right py-2 font-mono text-[10px]">
                  {nf.format(r)} t
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Variable de operación", (c: ReturnType<typeof unitCosts>) => c.variableClpT],
                ["Fijo mensual prorrateado", (c: ReturnType<typeof unitCosts>) => c.fixedClpT],
                ["Flota prorrateada", (c: ReturnType<typeof unitCosts>) => c.fleetClpT],
                [`Contingencia ${CONTINGENCY_PCT} %`, (c: ReturnType<typeof unitCosts>) => c.contingencyClpT],
              ] as Array<[string, (c: ReturnType<typeof unitCosts>) => number]>
            ).map(([label, pick]) => (
              <tr key={label} className="border-b border-hairline">
                <td className="py-2 text-content">{label}</td>
                {stepFleet.map((s) => (
                  <td key={s.rate} className="py-2 text-right font-mono text-content-muted">
                    {nf.format(Math.round(pick(s.cost)))}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-surface-2">
              <td className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                Costo total
              </td>
              {stepFleet.map((s) => (
                <td key={s.rate} className="py-2 text-right font-mono text-content">
                  {nf.format(Math.round(s.cost.totalClpT))}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                Margen vs tarifa {grade.toString().replace(".", ",")} %
              </td>
              {stepFleet.map((s) => {
                const margin = plan.tariffClpTms - s.cost.totalClpT;
                return (
                  <td
                    key={s.rate}
                    className={`py-2 text-right font-mono ${margin >= 0 ? "text-accent-brand" : "text-copper"}`}
                  >
                    {nf.format(Math.round(margin))}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Estructura de costos */}
      <div className="px-6 py-6 grid md:grid-cols-2 gap-x-8">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
            Costos variables (CLP/t)
          </div>
          {VARIABLE_COSTS.map((c) => (
            <div key={c.key} className="flex justify-between gap-4 py-2 border-b border-hairline">
              <span className="text-xs text-content-subtle">{c.label}</span>
              <span className="text-xs font-mono text-content">{nf.format(c.clpPerT)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
            Costos fijos mensuales (CLP/mes)
          </div>
          {FIXED_COSTS.map((c) => (
            <div key={c.key} className="flex justify-between gap-4 py-2 border-b border-hairline">
              <span className="text-xs text-content-subtle">{c.label}</span>
              <span className="text-xs font-mono text-content">{nf.format(c.clpPerMonth)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        <p className="text-[11px] text-content-subtle leading-relaxed border-l-2 border-copper pl-3">
          Estimación de ingeniería preliminar: costos unitarios, rendimientos y arriendos son
          referenciales y deben validarse con cotizaciones y ensayos metalúrgicos. La meseta de
          15.000 t/mes corresponde al plan declarado; la de 20.000 t/mes es una hipótesis de
          ampliación sujeta al marco regulatorio y a permisos, no autorizada a la fecha. Ningún
          escenario implica recursos ni reservas certificadas: el tonelaje del plan excede 2,74 veces
          el potencial conceptual de 60.750 t informado, y no existe VAN ni TIR auditados.
        </p>
      </div>
    </section>
  );
}
