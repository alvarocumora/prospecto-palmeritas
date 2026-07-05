import { Activity, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetalPrices, type MetalQuote } from "@/lib/commodityPrices.functions";
import { useCurrency, type Currency } from "@/lib/currency";

const FALLBACK: MetalQuote[] = [
  { code: "XAU", name: "Oro", priceUsd: null, price: "—", unit: "USD/oz", updatedAt: "" },
  { code: "XAG", name: "Plata", priceUsd: null, price: "—", unit: "USD/oz", updatedAt: "" },
  { code: "HG", name: "Cobre", priceUsd: null, price: "—", unit: "USD/lb", updatedAt: "" },
  { code: "XPT", name: "Platino", priceUsd: null, price: "—", unit: "USD/oz", updatedAt: "" },
  { code: "XPD", name: "Paladio", priceUsd: null, price: "—", unit: "USD/oz", updatedAt: "" },
];

export function CommodityTicker() {
  const fetchPrices = useServerFn(getMetalPrices);
  const { data } = useQuery({
    queryKey: ["marketing", "metal-prices"],
    queryFn: () => fetchPrices(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { currency, setCurrency, format, usdClp } = useCurrency();
  const items = data?.quotes && data.quotes.length > 0 ? data.quotes : FALLBACK;
  const isLive = Boolean(data?.quotes && data.quotes.length > 0);

  const renderPrice = (q: MetalQuote) => {
    if (q.priceUsd == null) return q.price;
    // Sacar "USD" del sufijo y reemplazar por moneda activa (ej: USD/oz -> CLP/oz)
    const suffix = q.unit.replace(/^USD/, "").replace(/^\//, "");
    return format(q.priceUsd, { unit: suffix ? `/${suffix}` : undefined });
  };

  return (
    <div className="border-y border-hairline bg-surface-inverse overflow-hidden">
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .ticker-track { animation: ticker-scroll 40s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .live-dot { animation: live-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="flex items-center">
        <div className="shrink-0 border-r border-white/10 px-3 py-2 flex items-center gap-1.5 bg-white/5 z-10">
          {isLive ? (
            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 live-dot" />
          ) : (
            <Activity className="w-3 h-3 text-accent-brand-subtle" />
          )}
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/60 whitespace-nowrap">
            {isLive ? "Precios en vivo" : "Cargando…"}
          </span>
        </div>

        <div className="overflow-hidden flex-1 min-w-0">
          <div className="ticker-track flex whitespace-nowrap">
            {[...items, ...items].map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-r border-white/5 shrink-0"
              >
                <span className="text-[10px] font-mono font-bold text-white/90 tracking-widest">
                  {item.code}
                </span>
                <span className="text-[10px] font-mono text-white/40">{item.name}</span>
                <span className="text-[13px] font-mono font-semibold text-white">
                  {renderPrice(item)}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="shrink-0 border-l border-white/10 bg-white/5 flex items-center"
          role="group"
          aria-label="Moneda"
        >
          {(["USD", "CLP"] as Currency[]).map((c) => {
            const active = currency === c;
            const disabled = c === "CLP" && usdClp == null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                disabled={disabled}
                title={
                  c === "CLP" && usdClp
                    ? `1 USD = ${usdClp.toLocaleString("es-CL", { maximumFractionDigits: 0 })} CLP`
                    : c === "CLP"
                      ? "Tipo de cambio no disponible"
                      : "Dólares estadounidenses"
                }
                className={
                  "px-2.5 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors " +
                  (active
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5") +
                  (disabled ? " opacity-40 cursor-not-allowed" : "")
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
