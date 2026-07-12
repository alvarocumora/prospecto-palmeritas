import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, AlertTriangle, X, Info, Star } from "lucide-react";
import { getCounterpartyReputation } from "@/lib/counterpartyReputation.functions";
import type { ReputationFactorStatus, ReputationTier } from "@/lib/counterpartyReputation";

const TIER_STYLE: Record<ReputationTier, { ring: string; text: string }> = {
  established: { ring: "text-emerald-600", text: "text-emerald-700" },
  emerging: { ring: "text-sky-600", text: "text-sky-700" },
  new: { ring: "text-slate-400", text: "text-content-subtle" },
  watch: { ring: "text-red-600", text: "text-red-700" },
};

const STATUS_ICON: Record<ReputationFactorStatus, { icon: typeof Check; className: string }> = {
  pass: { icon: Check, className: "text-emerald-600" },
  warn: { icon: AlertTriangle, className: "text-amber-600" },
  fail: { icon: X, className: "text-red-600" },
  info: { icon: Info, className: "text-content-subtle" },
};

/**
 * Buró de reputación de la contraparte: track record del vendedor en la
 * plataforma (trades cerrados, cancelaciones, lotes verificados, GMV).
 * Complementa al KYM (que verifica el activo). Público y de solo lectura.
 */
export function SellerReputationPanel({ lotId }: { lotId: string }) {
  const fn = useServerFn(getCounterpartyReputation);
  const { data, isLoading } = useQuery({
    queryKey: ["seller-reputation", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return <div className="h-32 rounded-xl border border-hairline bg-white animate-pulse" />;
  }
  if (!data) return null;

  const style = TIER_STYLE[data.tier];
  const pct = Math.max(0, Math.min(100, data.score));
  const dash = `${pct * 2.64} 264`;
  const memberYear = data.memberSince ? new Date(data.memberSince).getFullYear() : null;

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-accent-brand" />
        <h3 className="text-sm font-semibold tracking-tight">
          Reputación de la contraparte
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-content-subtle">
            buró Geocapitals
          </span>
        </h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-black/5"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={dash}
                className={style.ring}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{data.score}</span>
              <span className="text-[9px] uppercase tracking-wider text-content-subtle">/ 100</span>
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${style.text}`}>{data.tierLabel}</div>
            {data.orgName && (
              <div className="text-[11px] text-content mt-1 inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {data.orgName}
              </div>
            )}
            {memberYear && (
              <div className="text-[11px] text-content-subtle mt-0.5">
                Activo desde {memberYear}
              </div>
            )}
          </div>
        </div>

        <ul className="flex-1 space-y-1.5">
          {data.factors.map((f) => {
            const si = STATUS_ICON[f.status];
            const Icon = si.icon;
            return (
              <li key={f.key} className="flex items-start gap-2 text-[13px]">
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${si.className}`} />
                <span>
                  <span className="font-medium text-content">{f.label}: </span>
                  <span className="text-content-subtle">{f.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-[10px] text-content-subtle leading-relaxed">
        Reputación construida con el historial real de operaciones en Geocapitals. Se refina con
        cada trade; una cuenta nueva no implica riesgo, solo ausencia de historial.
      </p>
    </section>
  );
}
