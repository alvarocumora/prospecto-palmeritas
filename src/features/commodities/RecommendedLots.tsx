import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { recommendLotsForBuyer, type RecommendedLot } from "@/lib/matchmaking.functions";
import { commodityLabel, countryFlag } from "@/lib/commodityLabels";

/** Recomendaciones de lotes para el comprador (agente de matchmaking). */
export function RecommendedLots() {
  const [lots, setLots] = useState<RecommendedLot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    recommendLotsForBuyer()
      .then((r) => alive && setLots(r))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded || lots.length === 0) return null;

  return (
    <section className="mb-6 rounded border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-gold mb-3">
        <Sparkles className="w-3.5 h-3.5" /> Recomendados para ti
        <span className="text-muted-foreground normal-case">· según lo que buscas</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lots.map((l) => (
          <Link
            key={l.id}
            to="/marketplace/$lotId"
            params={{ lotId: l.slug ?? l.id }}
            className="group rounded border border-border bg-bg-panel p-3 hover:border-gold/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{l.title}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {countryFlag(l.country)} {commodityLabel(l.commodity)}
                  {l.tonnageAvailableT != null &&
                    ` · ${l.tonnageAvailableT.toLocaleString("es-CL")} t`}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-mono font-bold text-gold">{l.score}%</span>
            </div>
            {l.reasons.length > 0 && (
              <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-1">
                {l.reasons.join(" · ")}
              </div>
            )}
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono text-gold opacity-0 group-hover:opacity-100 transition-opacity">
              Ver lote <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
