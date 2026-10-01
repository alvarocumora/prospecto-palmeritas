import { useState } from "react";
import { COLLATERAL_TERMS, fmtClp, monthlyInterestClp } from "@/lib/investor/collateralProgram";

const TERMS = [12, 24, 36] as const;

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
    setAmount(a);
    setMonths(m);
    onChange?.(a, m);
  };

  return (
    <div className="border border-hairline bg-surface p-6">
      <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
        Simulador
      </p>
      <h3 className="font-serif text-2xl mt-1">Calcula tu interés mensual</h3>

      <label htmlFor="sim-amount" className="block text-xs text-content-subtle mt-5">
        Monto a invertir (CLP)
      </label>
      <input
        id="sim-amount"
        type="range"
        min={COLLATERAL_TERMS.minTicketClp}
        max={250_000_000}
        step={5_000_000}
        value={amount}
        onChange={(e) => update(Number(e.target.value), months)}
        className="w-full mt-2 accent-current text-accent-brand"
      />
      <div className="font-mono text-3xl mt-2">{fmtClp(amount)}</div>

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
      <p className="mt-3 text-[11px] text-content-subtle leading-relaxed">
        Cálculo nominal: {COLLATERAL_TERMS.annualRatePct} % anual / 12 sobre el capital, sin
        incluir el reajuste UF. La tasa es la pactada en el contrato, no una proyección de los
        proyectos mineros. Renovación cada {COLLATERAL_TERMS.reinvestEveryMonths} meses.
      </p>
    </div>
  );
}
