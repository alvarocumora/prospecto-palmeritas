import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, RefreshCw } from "lucide-react";
import { getMetalPrices } from "@/lib/commodityPrices.functions";
import { TerminalSectionFrame } from "@/features/terminal/TerminalSectionFrame";

export const Route = createFileRoute("/terminal/market")({
  head: () => ({ meta: [{ title: "Mercado de metales · Geocapitals" }] }),
  component: MarketPage,
});

const time = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })
  : "Fecha no informada";

function MarketPage() {
  const fetchPrices = useServerFn(getMetalPrices);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["metal-prices"], queryFn: () => fetchPrices(), staleTime: 60_000, refetchInterval: 120_000,
  });
  return (
    <TerminalSectionFrame eyebrow="Inteligencia de mercado" title="Mercado de metales" description="Precios de referencia para evaluar exposición a commodities. Cada lectura muestra su unidad y la fecha informada por el proveedor.">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <p className="text-xs text-muted-foreground">Fuente: Gold API · Moneda: USD</p>
        <button onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-60"><RefreshCw className={isFetching ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> Actualizar</button>
      </div>
      {isLoading ? <div role="status" className="rounded-xl border border-border p-8 text-sm text-muted-foreground">Consultando precios de referencia…</div> : isError || !data?.quotes.length ? (
        <div role="status" className="rounded-xl border border-border p-8"><h2 className="font-semibold">Precios no disponibles</h2><p className="text-sm text-muted-foreground mt-2">El proveedor no respondió con cotizaciones válidas. Puedes actualizar o continuar con la evaluación de proyectos.</p></div>
      ) : (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Referencias de metales">
          {data.quotes.map((quote) => (
            <article key={quote.code} className="rounded-xl border border-border bg-card/40 p-6 space-y-3">
              <div className="flex justify-between"><h2 className="font-semibold">{quote.name}</h2><span className="font-mono text-xs text-gold">{quote.code}</span></div>
              <p className="font-mono text-3xl">{quote.priceUsd == null ? "—" : quote.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 3 })}</p>
              <p className="text-xs text-muted-foreground">{quote.unit}</p>
              <p className="text-[11px] text-muted-foreground border-t border-border pt-3">Fecha del proveedor: {time(quote.updatedAt)}</p>
            </article>
          ))}
        </section>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Tipo de cambio USD / CLP</h2><p className="font-mono text-2xl mt-3">{data?.fx.usdClp == null ? "No disponible" : data.fx.usdClp.toLocaleString("es-CL", { maximumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground mt-2">Fuente: ExchangeRate API · Consulta: {data ? time(data.fx.fetchedAt) : "—"}</p></div>
        <div className="rounded-xl border border-border p-5 space-y-3"><h2 className="text-sm font-semibold">Del mercado a la oportunidad</h2><p className="text-sm text-muted-foreground">Contrasta la commodity con la etapa del activo, sus evidencias y el instrumento de inversión.</p><Link to="/proyectos" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">Explorar proyectos <ArrowRight className="w-4 h-4" /></Link></div>
      </div>
      <p className="text-xs text-muted-foreground">Referencias informativas; no son precios ejecutables ni una oferta de compraventa. La fecha de consulta no equivale a la fecha de mercado.</p>
    </TerminalSectionFrame>
  );
}
