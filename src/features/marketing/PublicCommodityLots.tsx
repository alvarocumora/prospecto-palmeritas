import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShieldCheck, MapPin, Scale, Gauge } from "lucide-react";
import { getPublicCommodityLots, type PublicCommodityLot } from "@/lib/marketing.functions";

function fmtTon(t: number | null): string {
  if (!t) return "—";
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k t`;
  return `${Math.round(t)} t`;
}

function fmtPrice(v: number | null, currency: string | null): string {
  if (!v) return "Sujeto a oferta";
  const cur = currency ?? "USD";
  return `${cur} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)}`;
}

function commodityColor(c: string): string {
  const map: Record<string, string> = {
    copper: "bg-orange-100 text-orange-900 border-orange-300",
    gold: "bg-amber-100 text-amber-900 border-amber-300",
    silver: "bg-slate-100 text-slate-900 border-slate-300",
    lithium: "bg-emerald-100 text-emerald-900 border-emerald-300",
    zinc: "bg-blue-100 text-blue-900 border-blue-300",
    iron: "bg-rose-100 text-rose-900 border-rose-300",
  };
  return map[c] ?? "bg-neutral-100 text-neutral-900 border-neutral-300";
}

function LotCard({ lot }: { lot: PublicCommodityLot }) {
  return (
    <Link
      to="/dashboard/commodity-lots"
      className="group flex flex-col border border-hairline bg-white hover:border-accent-brand transition-colors overflow-hidden"
    >
      <div className="aspect-[16/9] bg-neutral-100 relative overflow-hidden">
        {lot.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.cover_image_url}
            alt={lot.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 font-mono text-xs uppercase tracking-widest">
            {lot.commodity}
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border ${commodityColor(lot.commodity)}`}
          >
            {lot.commodity}
          </span>
          {lot.is_verified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-emerald-300 bg-emerald-50 text-emerald-900">
              <ShieldCheck className="w-3 h-3" /> Verificado
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="brand-display text-lg text-content leading-tight">{lot.title}</h3>
        {lot.summary && (
          <p className="mt-2 text-sm text-content-muted line-clamp-2">{lot.summary}</p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <div>
            <dt className="flex items-center gap-1 text-content-muted uppercase tracking-widest">
              <Gauge className="w-3 h-3" /> Ley
            </dt>
            <dd className="text-content mt-0.5">
              {lot.grade_pct ?? "—"}
              {lot.grade_pct ? (lot.grade_unit ?? "%") : ""}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-content-muted uppercase tracking-widest">
              <Scale className="w-3 h-3" /> Tonelaje
            </dt>
            <dd className="text-content mt-0.5">{fmtTon(lot.tonnage_available_t)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-content-muted uppercase tracking-widest">
              <MapPin className="w-3 h-3" /> Origen
            </dt>
            <dd className="text-content mt-0.5">{lot.country ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-4 pt-4 border-t border-hairline flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted">
              {lot.incoterm ?? "Precio"}
            </div>
            <div className="text-content font-semibold text-sm">
              {fmtPrice(lot.asking_price_usd, lot.currency)}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-content-muted group-hover:text-accent-brand group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export function PublicCommodityLots() {
  const fetchLots = useServerFn(getPublicCommodityLots);
  const { data, isLoading } = useQuery({
    queryKey: ["public-commodity-lots"],
    queryFn: () => fetchLots(),
    staleTime: 5 * 60_000,
  });

  const lots = data ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {isLoading &&
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-hairline bg-white animate-pulse aspect-[16/12]" />
        ))}
      {!isLoading && lots.length === 0 && (
        <div className="col-span-full border border-hairline bg-white p-10 text-center text-content-muted text-sm">
          Aún no hay lotes verificados publicados. Vuelve pronto.
        </div>
      )}
      {lots.map((l) => (
        <LotCard key={l.id} lot={l} />
      ))}
    </div>
  );
}
