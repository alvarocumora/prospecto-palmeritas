import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetalPrices, type MetalQuote } from "@/lib/commodityPrices.functions";

const FALLBACK: MetalQuote[] = [
  { code: "XAU", name: "Oro", price: "—", unit: "USD/oz", chg: "0.00%", up: true },
  { code: "XAG", name: "Plata", price: "—", unit: "USD/oz", chg: "0.00%", up: true },
  { code: "HG", name: "Cobre", price: "—", unit: "USD/lb", chg: "0.00%", up: true },
  { code: "XPT", name: "Platino", price: "—", unit: "USD/oz", chg: "0.00%", up: true },
  { code: "XPD", name: "Paladio", price: "—", unit: "USD/oz", chg: "0.00%", up: true },
];

export function CommodityTicker() {
  const fetchPrices = useServerFn(getMetalPrices);
  const { data } = useQuery({
    queryKey: ["marketing", "metal-prices"],
    queryFn: () => fetchPrices(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const items = data?.quotes && data.quotes.length > 0 ? data.quotes : FALLBACK;
  const isLive = Boolean(data?.quotes && data.quotes.length > 0);

  return (
    <div className="border-y border-hairline bg-surface-inverse overflow-hidden">
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker-scroll 48s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      <div className="flex items-center">
        <div className="shrink-0 border-r border-white/10 px-3 py-2 flex items-center gap-1.5 bg-white/5 z-10">
          <Activity className={`w-3 h-3 ${isLive ? "text-emerald-400" : "text-accent-brand-subtle"}`} />
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 whitespace-nowrap">
            {isLive ? "Precios en vivo" : "Cargando precios…"}
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
                <span className="text-[13px] font-mono font-semibold text-white">{item.price}</span>
                <span className="text-[9px] font-mono text-white/30">{item.unit}</span>
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold ${
                    item.up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {item.up ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {item.chg}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
