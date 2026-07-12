import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Check, AlertTriangle, X, Info } from "lucide-react";
import { getAdvanceOffer } from "@/lib/underwriting.functions";
import type { AdvanceEligibility, FactorStatus } from "@/lib/underwriting";

const ELIG_STYLE: Record<AdvanceEligibility, { chip: string; text: string }> = {
  eligible: { chip: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-700" },
  conditional: { chip: "bg-amber-500/10 border-amber-500/30", text: "text-amber-700" },
  ineligible: { chip: "bg-slate-500/10 border-slate-400/30", text: "text-content-subtle" },
};

const STATUS_ICON: Record<FactorStatus, { icon: typeof Check; className: string }> = {
  pass: { icon: Check, className: "text-emerald-600" },
  warn: { icon: AlertTriangle, className: "text-amber-600" },
  fail: { icon: X, className: "text-red-600" },
  info: { icon: Info, className: "text-content-subtle" },
};

/**
 * Motor de underwriting: anticipo pre-aprobado sobre el lote, derivado de los
 * tres scores (KYM del activo + reputación de la contraparte + valor pagable).
 * Indicativo, no vinculante. Público y de solo lectura.
 */
export function AdvanceOfferPanel({ lotId }: { lotId: string }) {
  const fn = useServerFn(getAdvanceOffer);
  const { data, isLoading } = useQuery({
    queryKey: ["advance-offer", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return <div className="h-40 rounded-xl border border-hairline bg-white animate-pulse" />;
  }
  if (!data) return null;

  const style = ELIG_STYLE[data.eligibility];
  const financeable = data.eligibility !== "ineligible";

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Banknote className="w-4 h-4 text-accent-brand" />
        <h3 className="text-sm font-semibold tracking-tight">
          Financiamiento · anticipo al vendedor
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-content-subtle">
            motor Geocapitals
          </span>
        </h3>
      </div>

      <div className={`rounded-lg border p-4 ${style.chip}`}>
        <div className={`text-sm font-semibold ${style.text}`}>{data.eligibilityLabel}</div>
        {financeable && data.maxAdvanceUsd != null && (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div>
              <span className="text-2xl font-bold text-content">
                US$ {data.maxAdvanceUsd.toLocaleString("en-US")}
              </span>
              <span className="text-[11px] text-content-subtle ml-1">anticipo máximo</span>
            </div>
            <div className="text-[11px] text-content-subtle">
              {data.advanceRatePct}% del valor · costo indicativo {data.indicativeFeePct}% /{" "}
              {data.tenorDays} días
            </div>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-1.5">
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

      {data.conditions.length > 0 && (
        <div className="mt-3 rounded-lg border border-hairline bg-slate-50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-content-subtle mb-1">
            {data.eligibility === "ineligible" ? "Motivos" : "Condiciones"}
          </div>
          <ul className="space-y-1">
            {data.conditions.map((c, i) => (
              <li key={i} className="text-[12px] text-content-subtle flex gap-1.5">
                <span className="text-accent-brand">·</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10px] text-content-subtle leading-relaxed">
        Estimación indicativa del motor de underwriting a partir de la verificación del activo, la
        reputación de la contraparte y el valor pagable. No constituye una oferta de crédito
        vinculante; queda sujeta a diligencia y aprobación final.
      </p>
    </section>
  );
}
