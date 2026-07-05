import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const ITEMS = [
  { code: "XAU", name: "Oro", price: "3,247.80", unit: "USD/oz", chg: "+1.24%", up: true },
  { code: "XAG", name: "Plata", price: "32.45", unit: "USD/oz", chg: "+0.87%", up: true },
  { code: "HG", name: "Cobre", price: "4.680", unit: "USD/lb", chg: "-0.33%", up: false },
  { code: "LI", name: "Li₂CO₃", price: "12,400", unit: "USD/t", chg: "+2.15%", up: true },
  { code: "CO", name: "Cobalto", price: "26,800", unit: "USD/t", chg: "-1.02%", up: false },
  { code: "NI", name: "Níquel", price: "15,970", unit: "USD/t", chg: "+0.44%", up: true },
  { code: "ZN", name: "Zinc", price: "2,890", unit: "USD/t", chg: "-0.18%", up: false },
  { code: "MO", name: "Molibdeno", price: "18.40", unit: "USD/lb", chg: "+0.66%", up: true },
  { code: "MN", name: "Manganeso", price: "1,940", unit: "USD/t", chg: "+0.22%", up: true },
  { code: "FE", name: "Hierro (Fe 62%)", price: "98.50", unit: "USD/t", chg: "-0.55%", up: false },
];

export function CommodityTicker() {
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
        {/* left badge */}
        <div className="shrink-0 border-r border-white/10 px-3 py-2 flex items-center gap-1.5 bg-white/5 z-10">
          <Activity className="w-3 h-3 text-accent-brand-subtle" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 whitespace-nowrap">
            Precios referencia
          </span>
        </div>

        {/* scrolling track */}
        <div className="overflow-hidden flex-1 min-w-0">
          <div className="ticker-track flex whitespace-nowrap">
            {[...ITEMS, ...ITEMS].map((item, i) => (
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
