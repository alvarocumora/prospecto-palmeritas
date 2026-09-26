// Ingesta manual de precios de referencia. Cualquier autenticado puede
// registrar lecturas (broker, mesa, prensa). Se muestran en las fichas y en
// el panel de inteligencia por commodity.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LineChart, Plus } from "lucide-react";
import { upsertCommodityPrice, getCommodityIntel } from "@/lib/commodityIntel.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/precios")({
  head: () => ({ meta: [{ title: "Precios de commodities — Geocapitals" }] }),
  component: PricesPage,
});

const PRESETS = [
  { symbol: "HG", name: "Copper", unit: "USD/lb" },
  { symbol: "XAU", name: "Gold", unit: "USD/oz" },
  { symbol: "XAG", name: "Silver", unit: "USD/oz" },
  { symbol: "SB", name: "Antimony", unit: "USD/MT" },
  { symbol: "REE", name: "Rare Earths (NdPr basket)", unit: "USD/kg" },
  { symbol: "LI", name: "Lithium carbonate", unit: "USD/MT" },
];

function PricesPage() {
  const upFn = useServerFn(upsertCommodityPrice);
  const intelFn = useServerFn(getCommodityIntel);
  const qc = useQueryClient();

  const [symbol, setSymbol] = useState("HG");
  const [name, setName] = useState("Copper");
  const [unit, setUnit] = useState("USD/lb");
  const [price, setPrice] = useState<number>(0);
  const [source, setSource] = useState("manual");
  const [change, setChange] = useState<number>(0);

  const { data: intel } = useQuery({
    queryKey: ["commodity-intel", name],
    queryFn: () => intelFn({ data: { commodity: name } }),
    enabled: !!name,
  });

  const mut = useMutation({
    mutationFn: () =>
      upFn({
        data: { symbol, name, unit, price, source, change_pct: change },
      }),
    onSuccess: () => {
      toast.success("Precio registrado");
      qc.invalidateQueries({ queryKey: ["commodity-intel"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div className="p-4 md:p-6 space-y-4" data-theme="im-light">
      <div className="flex items-center gap-2">
        <LineChart className="w-5 h-5 text-accent-brand" />
        <h1 className="text-xl font-semibold">Precios de referencia</h1>
      </div>
      <p className="text-xs text-muted-foreground max-w-2xl">
        Registra la lectura de precio que vas a usar en las fichas y en la calculadora CIF/FOB.
        Puedes empujar valores manuales (broker, prensa, LME) o dejar el default de mercado.
      </p>

      <div className="rounded-md border border-hairline bg-surface p-3 space-y-3 max-w-3xl">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.symbol}
              onClick={() => {
                setSymbol(p.symbol);
                setName(p.name);
                setUnit(p.unit);
              }}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${
                symbol === p.symbol
                  ? "border-accent-brand text-accent-brand"
                  : "border-hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.symbol} · {p.name}
            </button>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-6">
          <input
            placeholder="Símbolo"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
          />
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs md:col-span-2"
          />
          <input
            placeholder="Unidad"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
          />
          <input
            type="number"
            placeholder="Precio"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
          />
          <input
            type="number"
            placeholder="Var %"
            value={change}
            step="0.01"
            onChange={(e) => setChange(Number(e.target.value) || 0)}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
          />
          <input
            placeholder="Fuente"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded border border-hairline bg-transparent px-2 py-1 text-xs md:col-span-2"
          />
          <Button
            size="sm"
            className="h-8 text-xs md:col-span-2"
            disabled={!symbol || !name || !price || mut.isPending}
            onClick={() => mut.mutate()}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar lectura
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-hairline bg-surface p-3 max-w-3xl">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Últimas lecturas · {name}
        </div>
        {intel && intel.history.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground text-left">
              <tr className="border-b border-hairline">
                <th className="py-1 font-mono font-normal">Fecha</th>
                <th className="py-1 font-mono font-normal text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {[...intel.history]
                .reverse()
                .slice(0, 20)
                .map((h, i) => (
                  <tr key={i} className="border-b border-hairline/50">
                    <td className="py-1 font-mono text-muted-foreground">
                      {new Date(h.updated_at).toLocaleString("es-CL")}
                    </td>
                    <td className="py-1 font-mono text-right">{h.price}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-muted-foreground">Sin registros.</div>
        )}
      </div>
    </div>
  );
}
