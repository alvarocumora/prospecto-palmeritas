import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTerminalTicker, type TickerItem } from "@/lib/terminal.functions";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function TickerTape() {
  const fetchTicker = useServerFn(getTerminalTicker);
  const { data, isLoading } = useQuery({
    queryKey: ["terminal-ticker"],
    queryFn: () => fetchTicker(),
    refetchInterval: 60_000,
  });

  const items: TickerItem[] = data?.items ?? [];

  return (
    <div className="h-10 border-b border-border bg-background/95 flex items-center overflow-x-auto">
      <div className="flex items-center divide-x divide-border h-full">
        {items.length === 0 && (
          <span className="px-3 text-[10px] font-mono text-muted-foreground">
            {isLoading ? "Consultando mercado…" : "Referencias de mercado no disponibles"}
          </span>
        )}
        {items.map((t) => {
          const positive = t.change_pct >= 0;
          return (
            <div key={t.symbol} className="flex items-center gap-3 px-4 h-full whitespace-nowrap">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                {t.symbol}
              </span>
              <span className="text-xs font-mono font-semibold text-foreground">
                {t.price.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                <span className="text-muted-foreground ml-1">{t.unit}</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-mono",
                  positive ? "text-signal-green" : "text-signal-red",
                )}
              >
                {positive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {positive ? "+" : ""}
                {t.change_pct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
