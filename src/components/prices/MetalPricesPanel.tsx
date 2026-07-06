import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, TrendingUp, Truck, Factory, Info } from "lucide-react";
import { getMetalPrices } from "@/lib/metalPrices.functions";
import { compareEnamiPlants } from "@/lib/mining-economics";

function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `US$ ${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `US$ ${(v / 1e3).toFixed(1)}k`;
  return `US$ ${v.toFixed(0)}`;
}

/**
 * Panel de precios de metales para productores y vendedores.
 * Muestra el precio del cobre en vivo (BML/Banco Central) y calcula el poder de
 * compra ENAMI (pago neto al productor por planta) al precio actual.
 */
export function MetalPricesPanel() {
  const fn = useServerFn(getMetalPrices);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["metal-prices"],
    queryFn: () => fn(),
    staleTime: 10 * 60_000,
  });

  const [tonnes, setTonnes] = useState(100);
  const [grade, setGrade] = useState(2);

  const settlements = useMemo(() => {
    if (!data) return [];
    return compareEnamiPlants(tonnes, grade, data.cobreUsdT);
  }, [data, tonnes, grade]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Precios de metales · productores y vendedores</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Precio del cobre BML (London Metal Exchange) y poder de compra ENAMI en vivo.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 rounded bg-muted/20 animate-pulse" />
      ) : !data ? (
        <div className="p-6 text-center text-text-secondary text-sm">
          No se pudo obtener el precio del cobre.
        </div>
      ) : (
        <>
          {/* Precio del cobre */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <PriceCard
              label="Cobre BML"
              value={`US$ ${data.cobreUsdLb.toFixed(3)}`}
              unit="por libra"
              highlight
            />
            <PriceCard
              label="Cobre BML"
              value={`US$ ${data.cobreUsdT.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              unit="por tonelada"
            />
            <PriceCard
              label="Cobre"
              value={
                data.cobreClpLb != null
                  ? `$${data.cobreClpLb.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`
                  : "—"
              }
              unit="CLP por libra"
            />
            <PriceCard
              label="Dólar observado"
              value={data.dolarClp != null ? `$${data.dolarClp.toLocaleString("es-CL")}` : "—"}
              unit="CLP por USD"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-secondary">
            <Info className="w-3 h-3" />
            Fuente: {data.source}
            {data.fecha && ` · ${new Date(data.fecha).toLocaleDateString("es-CL")}`}
            {data.stale && " · valor de referencia (fuente en vivo no disponible)"}
          </div>

          {/* Poder de compra ENAMI */}
          <section className="border border-border rounded-md bg-bg-secondary/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-mono uppercase tracking-wider">Poder de compra ENAMI</h2>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              Pago neto estimado al productor por venta de mineral chancable, al precio de cobre
              actual. Ajusta el tonelaje y la ley para tu lote.
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-md mb-4">
              <label className="text-xs">
                <span className="block text-text-secondary mb-1">Toneladas de mineral</span>
                <input
                  type="number"
                  min={1}
                  value={tonnes}
                  onChange={(e) => setTonnes(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="text-xs">
                <span className="block text-text-secondary mb-1">Ley de cobre (% Cu)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={grade}
                  onChange={(e) => setGrade(Math.max(0.1, Number(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-text-secondary uppercase tracking-wider text-[10px] border-b border-border">
                  <tr>
                    <th className="py-1.5 pr-2">Planta ENAMI</th>
                    <th className="py-1.5 px-2">Dist.</th>
                    <th className="py-1.5 px-2 text-right">Bruto Cu (BML)</th>
                    <th className="py-1.5 px-2 text-right">Maquila+Refin.</th>
                    <th className="py-1.5 px-2 text-right">Transporte</th>
                    <th className="py-1.5 px-2 text-right">Pago neto</th>
                    <th className="py-1.5 pl-2 text-right">US$/t</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s, i) => (
                    <tr
                      key={s.plant.code}
                      className={`border-b border-border last:border-0 ${i === 0 ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="py-1.5 pr-2">
                        <div className="font-medium flex items-center gap-1.5">
                          {i === 0 && <Factory className="w-3 h-3 text-emerald-500" />}
                          {s.plant.name}
                        </div>
                        <div className="text-text-secondary">{s.plant.city}</div>
                      </td>
                      <td className="py-1.5 px-2 text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {s.plant.distance_km} km
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right">{fmtUsd(s.lmeRevenueUsd)}</td>
                      <td className="py-1.5 px-2 text-right text-text-secondary">
                        {fmtUsd(s.maquilaUsd + s.refiningUsd)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-text-secondary">
                        {fmtUsd(s.transportUsd)}
                      </td>
                      <td
                        className={`py-1.5 px-2 text-right font-semibold ${
                          s.netToProducerUsd >= 0 ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {fmtUsd(s.netToProducerUsd)}
                      </td>
                      <td className="py-1.5 pl-2 text-right">{s.marginUsdPerTon.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-text-secondary mt-3 leading-relaxed">
              Modelo referencial (tarifario pequeña minería ENAMI). Incluye opex de mina + chancado
              y contingencia. Valida contra tu contrato vigente antes de operar; no constituye una
              oferta de compra.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function PriceCard({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded-md p-3 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-bg-secondary/30"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      <div className="text-[10px] font-mono text-text-secondary">{unit}</div>
    </div>
  );
}
