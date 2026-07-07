import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { estimatePayableValue } from "@/lib/payableValue.functions";
import type { MarketComparison } from "@/lib/payableValue.functions";

function usd(v: number, frac = 0): string {
  return `US$ ${v.toLocaleString("en-US", { maximumFractionDigits: frac })}`;
}

const VERDICT: Record<
  MarketComparison["verdict"],
  { label: string; className: string; icon: typeof Minus }
> = {
  en_mercado: { label: "En mercado", className: "text-emerald-700 bg-emerald-50", icon: Minus },
  sobre_mercado: {
    label: "Sobre mercado",
    className: "text-red-700 bg-red-50",
    icon: TrendingUp,
  },
  bajo_mercado: {
    label: "Bajo mercado (oportunidad)",
    className: "text-emerald-700 bg-emerald-50",
    icon: TrendingDown,
  },
  sin_datos: {
    label: "Sin precio pedido",
    className: "text-content-subtle bg-black/5",
    icon: Minus,
  },
};

/**
 * Panel del agente Assay-to-Value: pago neto estimado del lote a precio de
 * mercado en vivo, con desglose y comparación contra el precio pedido.
 */
export function LotValuationPanel({ lotId }: { lotId: string }) {
  const fn = useServerFn(estimatePayableValue);
  const { data, isLoading } = useQuery({
    queryKey: ["lot-valuation", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return <div className="h-40 rounded-xl border border-hairline bg-white animate-pulse" />;
  }
  if (!data) return null;
  const { result: r, market } = data;

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-accent-brand" />
        <h3 className="text-sm font-semibold tracking-tight">
          Valor pagable estimado
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-content-subtle">
            agente Assay-to-Value
          </span>
        </h3>
      </div>

      {!r.supported ? (
        <div className="flex items-start gap-2 text-[13px] text-content-subtle">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <span>{r.notes[0] ?? "No fue posible estimar el valor de este lote."}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-2xl font-bold text-content">
                {usd(r.netUsdDmt)}
                <span className="text-sm font-normal text-content-subtle"> neto/t</span>
              </div>
              <div className="text-[11px] text-content-subtle">
                {r.basis} · rango {usd(r.band.low)}–{usd(r.band.high)}
              </div>
              {r.payableLabel && (
                <div className="text-[11px] text-content-subtle mt-0.5">{r.payableLabel}</div>
              )}
            </div>
            {r.netTotalUsd != null && (
              <div>
                <div className="text-lg font-semibold text-content">{usd(r.netTotalUsd)}</div>
                <div className="text-[11px] text-content-subtle">valor neto del lote</div>
              </div>
            )}
          </div>

          {/* Desglose por tonelada */}
          <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
            <Row label="Valor bruto del metal" value={usd(r.grossUsdT)} />
            {r.tcUsdT > 0 && <Row label="− Tratamiento (TC)" value={`−${usd(r.tcUsdT)}`} muted />}
            {r.rcUsdT > 0 && <Row label="− Refinación (RC)" value={`−${usd(r.rcUsdT)}`} muted />}
            {r.penaltyLines.map((p) => (
              <Row
                key={p.code}
                label={`− Castigo ${p.label} (${p.pct}%)`}
                value={`−${usd(p.usdT)}`}
                muted
              />
            ))}
            <Row label="= Pago neto/t" value={usd(r.netUsdDmt)} strong />
          </div>

          {/* Comparación con el precio pedido */}
          {(() => {
            const v = VERDICT[market.verdict];
            const Icon = v.icon;
            return (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${v.className}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {v.label}
                </span>
                {market.askingTotalUsd != null && (
                  <span className="text-[11px] text-content-subtle">
                    Precio pedido {usd(market.askingTotalUsd)}
                    {market.deltaPct != null && (
                      <>
                        {" "}
                        · {market.deltaPct > 0 ? "+" : ""}
                        {(market.deltaPct * 100).toFixed(0)}% vs. estimado
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })()}
        </>
      )}

      <p className="mt-3 text-[10px] text-content-subtle leading-relaxed">
        Estimación referencial con precio de mercado en vivo (cobre: Banco Central; oro/plata:
        gold-api) y términos TC/RC y castigos benchmark. No es una oferta ni sustituye la
        negociación comercial.
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/60 py-0.5">
      <span className={muted ? "text-content-subtle" : "text-content"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-content" : "text-content"}`}>
        {value}
      </span>
    </div>
  );
}
