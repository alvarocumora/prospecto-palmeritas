import { useMemo, useState } from "react";
import { CHOLQUI_SCENARIOS, fmtClp, fmtClpM } from "../data/cholqui";
import {
  CHOLQUI_COMMERCIAL_DESTINATIONS,
  LEGACY_FREIGHT_ASSUMPTION,
  auditDeclaredProductionPlan,
} from "../data/commercialModel";
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
    () =>
      projectCashflow({
        plateau,
        gradePct: grade,
        startRate: 1_000,
        rampMonths: 12,
        totalMonths: 24,
      }),
    [plateau, grade],
  );
  const option = PLATEAU_OPTIONS.find((o) => o.plateau === plateau) ?? PLATEAU_OPTIONS[0];
  const productionAudit = auditDeclaredProductionPlan();
  const maxRate = Math.max(...plan.months.map((m) => m.rate));
  const cashMin = Math.min(...plan.months.map((m) => m.cumulativeCashflowClp));
  const cashMax = Math.max(...plan.months.map((m) => m.cumulativeCashflowClp));
  const cashSpan = Math.max(1, cashMax - cashMin);

  const stepFleet = RATE_STEPS.map((r) => ({
    rate: r,
    fleet: fleetForRate(r),
    cost: unitCosts(r),
  }));

  /** Sensibilidad a 24 meses: cada meseta × cada ley de Cu soluble. */
  const sensitivity = useMemo(
    () =>
      PLATEAU_OPTIONS.flatMap((o) =>
        CHOLQUI_SCENARIOS.map((s) => ({
          plateau: o.plateau,
          grade: s.grade,
          run: projectCashflow({
            plateau: o.plateau,
            gradePct: s.grade,
            startRate: 1_000,
            rampMonths: 12,
            totalMonths: 24,
          }),
        })),
      ),
    [],
  );

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
          Proyección mes a mes de producción, flota, costos y venta a ENAMI partiendo de 1.000
          t/mes. La flota se dimensiona a partir del tonelaje —no de un dato suelto— y los costos
          separan componentes variables por tonelada de costos fijos mensuales, de modo que el costo
          unitario baja al escalar. Cifras de ingeniería preliminar, no cotizaciones cerradas.
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

      <div className="px-6 py-4 border-b border-hairline bg-surface-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-copper">
          Control de consistencia comercial · PENDING_DD
        </div>
        <p className="text-xs text-content-subtle mt-2 max-w-4xl">
          El documento declara {nf.format(productionAudit.declaredTonnes)} t en 24 meses, mientras
          la rampa matemática 1.000→15.000 t/mes genera{" "}
          {nf.format(productionAudit.mathematicalRampTonnes)} t (+{nf.format(productionAudit.deltaTonnes)} t).
          El payback de esta simulación queda bloqueado como KPI de decisión hasta reconciliar
          inventario, metalurgia, aceptación comercial, distancia vial, flete y liquidación.
        </p>
        <div className="mt-3 grid md:grid-cols-2 gap-2 text-[11px] text-content-subtle">
          {CHOLQUI_COMMERCIAL_DESTINATIONS.map((destination) => (
            <div key={destination.id} className="border border-hairline rounded-lg p-3 bg-white">
              <span className="font-mono text-content">{destination.operator}</span> ·{" "}
              {destination.facility}
              <div className="mt-1">
                Producto: {destination.productFit === "OXIDE_CONFIRMED" ? "óxidos confirmados" : "aceptación por confirmar"}
                {" · "}Distancia vial: por verificar{" · "}Cotización: pendiente
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-content-subtle mt-3">
          Flete histórico del modelo: {LEGACY_FREIGHT_ASSUMPTION.distanceKm} km × CLP{" "}
          {nf.format(LEGACY_FREIGHT_ASSUMPTION.clpPerTkm)}/t·km = CLP{" "}
          {nf.format(LEGACY_FREIGHT_ASSUMPTION.clpPerT)}/t. Es un supuesto de planificación, no una
          distancia vial ni una cotización verificadas.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
        {(
          [
            ["Mineral del ciclo", `${nf.format(plan.totalTonnes)} t / 24 meses`],
            ["Ingresos a tarifa ENAMI", fmtClpM(plan.totalRevenueClp)],
            ["Superávit operacional", fmtClpM(plan.operatingSurplusClp)],
            [
              "Equilibrio acumulado",
              plan.decisionGradePaybackMonth
                ? `Mes ${plan.decisionGradePaybackMonth}`
                : "Bloqueado · DD comercial",
            ],
            ["Tarifa aplicada", `${fmtClp(plan.tariffClpTms)}/tms`],
            ["Costo medio del ciclo", `${fmtClp(Math.round(plan.avgUnitCostClpT))}/t`],
            ["Margen medio", `${fmtClp(Math.round(plan.marginClpT))}/t`],
            [
              "Punto de equilibrio",
              plan.breakevenRate
                ? `${nf.format(plan.breakevenRate)} t/mes`
                : "No alcanzable ≤ 30.000 t/mes",
            ],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              {k}
            </div>
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
            <div
              key={m.month}
              className="flex-1 flex flex-col justify-end h-full"
              title={`Mes ${m.month}: ${nf.format(m.rate)} t`}
            >
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

      {/* Proyección mensual de ventas, costos y caja */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Proyección mensual a 24 meses · meseta {nf.format(plateau)} t/mes · ley{" "}
          {grade.toString().replace(".", ",")} % Cu soluble
        </div>
        <table className="w-full text-xs border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              {[
                "Mes",
                "t/mes",
                "Acum. t",
                "Precio CLP/tms",
                "Ingresos",
                "Costo total",
                "Margen",
                "Caja acumulada",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`py-2 font-mono uppercase tracking-wider text-[10px] ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.months.map((m) => (
              <tr
                key={m.month}
                className={`border-b border-hairline ${
                  plan.paybackMonth === m.month ? "bg-accent-brand/5" : ""
                }`}
              >
                <td className="py-1.5 font-mono text-content">{m.month}</td>
                <td className="py-1.5 text-right font-mono text-content">{nf.format(m.rate)}</td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {nf.format(m.cumulativeT)}
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {nf.format(Math.round(plan.tariffClpTms))}
                </td>
                <td className="py-1.5 text-right font-mono text-content">
                  {fmtClpM(m.revenueClp)}
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {fmtClpM(m.costClp)}
                </td>
                <td
                  className={`py-1.5 text-right font-mono ${m.marginClp >= 0 ? "text-accent-brand" : "text-copper"}`}
                >
                  {fmtClpM(m.marginClp)}
                </td>
                <td
                  className={`py-1.5 text-right font-mono ${
                    m.cumulativeCashflowClp >= 0 ? "text-content" : "text-copper"
                  }`}
                >
                  {fmtClpM(m.cumulativeCashflowClp)}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-2">
              <td className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                Total 24 m
              </td>
              <td className="py-2 text-right font-mono text-content">—</td>
              <td className="py-2 text-right font-mono text-content">
                {nf.format(plan.totalTonnes)}
              </td>
              <td className="py-2 text-right font-mono text-content-muted">
                {nf.format(Math.round(plan.tariffClpTms))}
              </td>
              <td className="py-2 text-right font-mono text-content">
                {fmtClpM(plan.totalRevenueClp)}
              </td>
              <td className="py-2 text-right font-mono text-content">
                {fmtClpM(plan.totalCostClp)}
              </td>
              <td className="py-2 text-right font-mono text-content">
                {fmtClpM(plan.operatingSurplusClp)}
              </td>
              <td className="py-2 text-right font-mono text-content">
                {fmtClpM(plan.netAfterCapexClp)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-content-subtle mt-2">
          El precio corresponde a la tarifa ENAMI aplicable a la ley seleccionada (Circular N°27);
          no incluye reajustes de mercado ni retención tributaria posterior. La caja acumulada parte
          de la inversión inicial de {fmtClpM(plan.capexClp)}.
        </p>
      </div>

      {/* Sensibilidad */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Sensibilidad a 24 meses · meseta × ley de Cu soluble
        </div>
        <table className="w-full text-xs border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              {[
                "Escenario",
                "Ley Cu sol.",
                "Mineral",
                "Precio CLP/tms",
                "Ingresos",
                "Costos",
                "Margen",
                "Caja neta",
                "Equilibrio",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`py-2 font-mono uppercase tracking-wider text-[10px] ${i < 2 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((s) => (
              <tr
                key={`${s.plateau}-${s.grade}`}
                className={`border-b border-hairline ${
                  s.plateau === plateau && s.grade === grade ? "bg-accent-brand/5" : ""
                }`}
              >
                <td className="py-1.5 text-content">{nf.format(s.plateau)} t/mes</td>
                <td className="py-1.5 font-mono text-content-muted">
                  {s.grade.toString().replace(".", ",")} %
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {nf.format(s.run.totalTonnes)} t
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {nf.format(Math.round(s.run.tariffClpTms))}
                </td>
                <td className="py-1.5 text-right font-mono text-content">
                  {fmtClpM(s.run.totalRevenueClp)}
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {fmtClpM(s.run.totalCostClp)}
                </td>
                <td
                  className={`py-1.5 text-right font-mono ${
                    s.run.operatingSurplusClp >= 0 ? "text-accent-brand" : "text-copper"
                  }`}
                >
                  {fmtClpM(s.run.operatingSurplusClp)}
                </td>
                <td className="py-1.5 text-right font-mono text-content">
                  {fmtClpM(s.run.netAfterCapexClp)}
                </td>
                <td className="py-1.5 text-right font-mono text-content-muted">
                  {s.run.decisionGradePaybackMonth
                    ? `Mes ${s.run.decisionGradePaybackMonth}`
                    : "Bloqueado"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Flota por escalón */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Maquinaria por escalón de producción · operativas + respaldo (arriendo con operador)
        </div>
        <table className="w-full text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              <th className="text-left py-2 font-mono uppercase tracking-wider text-[10px]">
                Equipo
              </th>
              <th className="text-right py-2 font-mono text-[10px]">Disp.</th>
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
                  {line.spec.critical && (
                    <span className="ml-2 text-[9px] font-mono uppercase tracking-wider text-accent-brand">
                      crítico
                    </span>
                  )}
                  <div className="text-[10px] text-content-subtle">{line.spec.note}</div>
                </td>
                <td className="py-2 text-right font-mono text-content-muted">
                  {Math.round(line.spec.availability * 100)} %
                </td>
                {stepFleet.map((s) => {
                  const l = s.fleet.lines[idx];
                  return (
                    <td key={s.rate} className="py-2 text-right font-mono text-content">
                      {l.operatingUnits}
                      {l.standbyUnits > 0 && (
                        <span className="text-copper"> + {l.standbyUnits}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b border-hairline">
              <td
                className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle"
                colSpan={2}
              >
                Costo de equipos operativos (CLP/mes)
              </td>
              {stepFleet.map((s) => (
                <td key={s.rate} className="py-2 text-right font-mono text-content-muted">
                  {fmtClpM(s.fleet.operatingClp)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-hairline">
              <td
                className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle"
                colSpan={2}
              >
                Costo de equipos de respaldo (CLP/mes)
              </td>
              {stepFleet.map((s) => (
                <td key={s.rate} className="py-2 text-right font-mono text-copper">
                  {fmtClpM(s.fleet.standbyClp)}
                </td>
              ))}
            </tr>
            <tr className="bg-surface-2">
              <td
                className="py-2 font-mono text-[10px] uppercase tracking-wider text-content-subtle"
                colSpan={2}
              >
                Costo total de flota (CLP/mes)
              </td>
              {stepFleet.map((s) => (
                <td key={s.rate} className="py-2 text-right font-mono text-content">
                  {fmtClpM(s.fleet.monthlyClp)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-content-subtle mt-3 max-w-3xl">
          Las unidades operativas se dimensionan sobre capacidad efectiva (capacidad nominal ×
          disponibilidad mecánica). Los equipos críticos suman una unidad de respaldo desde su
          umbral de ritmo, de modo que una falla no detiene la cadena; el stand-by se tarifa a valor
          reducido por no operar a plena carga. Estimación de ingeniería preliminar, no cotizaciones
          cerradas.
        </p>
      </div>

      {/* Costos unitarios */}
      <div className="px-6 py-6 border-b border-hairline overflow-x-auto">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Costo por tonelada según ritmo (CLP/t) — el fijo se diluye al escalar
        </div>
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-hairline text-content-subtle">
              <th className="text-left py-2 font-mono uppercase tracking-wider text-[10px]">
                Componente
              </th>
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
                [
                  `Contingencia ${CONTINGENCY_PCT} %`,
                  (c: ReturnType<typeof unitCosts>) => c.contingencyClpT,
                ],
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
          escenario implica recursos ni reservas certificadas: el tonelaje del plan excede 2,74
          veces el potencial conceptual de 60.750 t informado, y no existe VAN ni TIR auditados.
        </p>
      </div>
    </section>
  );
}
