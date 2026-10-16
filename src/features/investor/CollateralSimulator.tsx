import { useState } from "react";
import {
  COLLATERAL_PROJECTS,
  COLLATERAL_TERMS,
  fmtClp,
  monthlyInterestClp,
} from "@/lib/investor/collateralProgram";

const TERMS = [12, 24, 36] as const;
const QUICK = [15_000_000, 25_000_000, 50_000_000, 100_000_000];
const MAX = 250_000_000;

/** Precio lista mínimo publicado de cada valle (CLP), para orientar el colateral. */
const MIN_LIST: Record<string, number> = { hualane: 12_990_000, "valle-escondido": 19_990_000 };

/** Simulador del programa con colateral: solo la tasa pactada, sin proyecciones mineras. */
export function CollateralSimulator({
  onChange,
}: {
  onChange?: (amount: number, months: number) => void;
}) {
  const [amount, setAmount] = useState<number>(COLLATERAL_TERMS.minTicketClp);
  const [months, setMonths] = useState<number>(12);
  const monthly = monthlyInterestClp(amount);
  const update = (a: number, m: number) => {
    const clamped = Math.min(MAX, Math.max(COLLATERAL_TERMS.minTicketClp, a));
    setAmount(clamped);
    setMonths(m);
    onChange?.(clamped, m);
  };
  const eligible = COLLATERAL_PROJECTS.filter((p) => amount >= (MIN_LIST[p.key] ?? Infinity));

  return (
    <div className="border border-hairline bg-surface p-6">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
        Simulador
      </p>
      <h3 className="font-serif text-2xl mt-1">Calcula tu interés mensual</h3>

      <label htmlFor="sim-amount" className="block text-xs text-content-subtle mt-5">
        Monto a invertir (CLP) · desde {fmtClp(COLLATERAL_TERMS.minTicketClp)}
      </label>
      <input
        id="sim-amount"
        type="range"
        min={COLLATERAL_TERMS.minTicketClp}
        max={MAX}
        step={1_000_000}
        value={amount}
        onChange={(e) => update(Number(e.target.value), months)}
        className="w-full mt-2 accent-current text-accent-brand"
      />
      <div className="font-mono text-3xl mt-2">{fmtClp(amount)}</div>
      <div className="mt-3 grid grid-cols-4 gap-px bg-hairline border border-hairline">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => update(q, months)}
            className={`py-1.5 text-xs font-mono transition-colors ${
              amount === q ? "bg-content text-surface" : "bg-surface hover:bg-accent-brand-subtle"
            }`}
          >
            ${q / 1_000_000} MM
          </button>
        ))}
      </div>

      <div className="mt-4 text-xs text-content-subtle">Plazo</div>
      <div className="mt-2 grid grid-cols-3 gap-px bg-hairline border border-hairline">
        {TERMS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => update(amount, m)}
            className={`py-2 text-sm font-mono transition-colors ${
              months === m ? "bg-content text-surface" : "bg-surface hover:bg-accent-brand-subtle"
            }`}
          >
            {m} meses
          </button>
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px bg-hairline border border-hairline">
        <div className="bg-accent-brand-subtle p-4 col-span-2">
          <dt className="text-[11px] font-mono uppercase tracking-wider text-accent-brand">
            Interés mensual
          </dt>
          <dd className="font-mono text-3xl mt-1">{fmtClp(monthly)}</dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-[11px] text-content-subtle">Intereses en {months} meses</dt>
          <dd className="font-mono text-lg">{fmtClp(monthly * months)}</dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-[11px] text-content-subtle">Capital devuelto al final</dt>
          <dd className="font-mono text-lg">{fmtClp(amount)} + UF</dd>
        </div>
      </dl>

      <table className="mt-4 w-full text-xs border border-hairline">
        <thead>
          <tr className="text-content-subtle text-left">
            <th className="p-2 font-normal">Plazo</th>
            <th className="p-2 font-normal text-right">Intereses acumulados</th>
            <th className="p-2 font-normal text-right">Total recibido</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {TERMS.map((m) => (
            <tr
              key={m}
              className={`border-t border-hairline ${m === months ? "bg-accent-brand-subtle" : ""}`}
            >
              <td className="p-2">{m} meses</td>
              <td className="p-2 text-right">{fmtClp(monthly * m)}</td>
              <td className="p-2 text-right">{fmtClp(amount + monthly * m)} + UF</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 border-l-2 border-accent-brand pl-3 text-xs">
        <div className="font-medium">Colateral orientativo para este monto</div>
        <p className="text-content-subtle mt-0.5">
          {eligible.length
            ? `Alcanza el precio lista de entrada en: ${eligible.map((p) => p.name).join(" · ")}.`
            : "Por confirmar con el equipo."}{" "}
          La parcela, su rol y su tasación se fijan en el contrato.
        </p>
      </div>

      <p className="mt-3 text-[11px] text-content-subtle leading-relaxed">
        Cálculo nominal: {COLLATERAL_TERMS.annualRatePct} % anual / 12 sobre el capital, sin incluir
        el reajuste UF. La tasa es la pactada en el contrato, no una proyección de los proyectos
        mineros. Renovación cada {COLLATERAL_TERMS.reinvestEveryMonths} meses.
      </p>
    </div>
  );
}
