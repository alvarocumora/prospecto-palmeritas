import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Info } from "lucide-react";
import { getPriceIndex } from "@/lib/priceIndex.functions";
import { premiumVsAnchor, type ConfidenceLevel } from "@/lib/priceIndex";
import { commodityLabel } from "@/lib/commodityLabels";

const CONF_STYLE: Record<ConfidenceLevel, { label: string; className: string }> = {
  high: { label: "Alta", className: "text-emerald-500" },
  medium: { label: "Media", className: "text-amber-500" },
  low: { label: "Baja", className: "text-text-secondary" },
};

/**
 * Índice de Precios Geocapitals: benchmark propietario por commodity a partir de
 * las transacciones y la demanda reales del marketplace. Dato de referencia que
 * ninguna otra plataforma puede construir (requiere el flujo de trades).
 */
export function PriceIndexPanel() {
  const fn = useServerFn(getPriceIndex);
  const { data, isLoading } = useQuery({
    queryKey: ["price-index"],
    queryFn: () => fn(),
    staleTime: 10 * 60_000,
  });

  return (
    <section className="p-4 md:p-6 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-wider">
          Índice de Precios Geocapitals
        </h2>
      </div>
      <p className="text-xs text-text-secondary max-w-2xl">
        Precio efectivo al que se transan los commodities <strong>dentro de la plataforma</strong>{" "}
        (transacciones + demanda), no el de bolsa. Se refina con cada operación.
      </p>

      {isLoading ? (
        <div className="h-32 rounded bg-muted/20 animate-pulse" />
      ) : !data || data.entries.length === 0 ? (
        <div className="rounded-md border border-border bg-bg-secondary/20 p-6 text-center text-sm text-text-secondary">
          Aún no hay suficientes operaciones para publicar el índice. Se activa a medida que se
          registran transacciones y consultas con precio en el marketplace.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="text-left text-text-secondary uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                <tr>
                  <th className="py-2 px-3">Commodity</th>
                  <th className="py-2 px-2 text-right">Benchmark US$/t</th>
                  <th className="py-2 px-2 text-right">Rango</th>
                  <th className="py-2 px-2 text-right">vs. cobre BML</th>
                  <th className="py-2 px-2 text-right">Muestras</th>
                  <th className="py-2 px-3 text-right">Confianza</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => {
                  const isCu = e.commodity.startsWith("cu_");
                  const prem = isCu ? premiumVsAnchor(e.benchmarkUsdT, data.cuAnchorUsdT) : null;
                  const conf = CONF_STYLE[e.confidence];
                  return (
                    <tr key={e.commodity} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 font-medium">{commodityLabel(e.commodity)}</td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {e.benchmarkUsdT.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 px-2 text-right text-text-secondary">
                        {e.low.toLocaleString("en-US")}–{e.high.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {prem == null ? (
                          <span className="text-text-secondary">—</span>
                        ) : (
                          <span className={prem >= 0 ? "text-emerald-500" : "text-red-500"}>
                            {prem >= 0 ? "+" : ""}
                            {prem.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-text-secondary">
                        {e.sampleCount}
                        {e.tradeCount > 0 && (
                          <span className="text-[10px]"> · {e.tradeCount} tx</span>
                        )}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${conf.className}`}>
                        {conf.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-secondary">
            <Info className="w-3 h-3" />
            {data.totalSamples} punto(s) de precio ·{" "}
            {data.cuAnchorUsdT
              ? `ancla cobre BML US$ ${data.cuAnchorUsdT.toLocaleString("en-US", { maximumFractionDigits: 0 })}/t`
              : "ancla BML no disponible"}{" "}
            · {new Date(data.generatedAt).toLocaleString("es-CL")}
          </div>
        </>
      )}
    </section>
  );
}
