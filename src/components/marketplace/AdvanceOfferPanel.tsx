import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Banknote, Check, AlertTriangle, X, Info, Loader2 } from "lucide-react";
import { getAdvanceOffer } from "@/lib/underwriting.functions";
import { createAdvanceRequest } from "@/lib/advanceRequests.functions";
import { useAuth } from "@/hooks/useAuth";
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
 * El vendedor puede solicitar el anticipo (workflow). Indicativo, no vinculante.
 */
export function AdvanceOfferPanel({ lotId }: { lotId: string }) {
  const { user } = useAuth();
  const fn = useServerFn(getAdvanceOffer);
  const requestFn = useServerFn(createAdvanceRequest);
  const { data, isLoading } = useQuery({
    queryKey: ["advance-offer", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });

  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (isLoading) {
    return <div className="h-40 rounded-xl border border-hairline bg-white animate-pulse" />;
  }
  if (!data) return null;

  const style = ELIG_STYLE[data.eligibility];
  const financeable = data.eligibility !== "ineligible";
  const amountValue = amount === "" ? (data.maxAdvanceUsd ?? 0) : Number(amount);

  const onRequest = async () => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }
    setSubmitting(true);
    try {
      await requestFn({ data: { lotId, requestedAmountUsd: amountValue } });
      setDone(true);
      toast.success("Solicitud enviada. Síguela en Anticipos del dashboard.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Solicitud del vendedor */}
      {financeable && data.maxAdvanceUsd != null && (
        <div className="mt-4 border-t border-hairline pt-4">
          {done ? (
            <div className="text-[13px] text-emerald-700">
              Solicitud enviada.{" "}
              <Link to="/dashboard/anticipos" className="underline">
                Ver mis anticipos
              </Link>
            </div>
          ) : !user ? (
            <Link to="/auth" className="text-[13px] text-accent-brand underline">
              Inicia sesión como vendedor para solicitar el anticipo
            </Link>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-content-subtle">
                <span className="block mb-1">Monto a solicitar (US$)</span>
                <input
                  type="number"
                  min={1}
                  max={data.maxAdvanceUsd}
                  value={amount}
                  placeholder={String(data.maxAdvanceUsd)}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-40 rounded border border-hairline px-2 py-1.5 text-[13px] text-content focus:outline-none focus:ring-1 focus:ring-accent-brand"
                />
              </label>
              <button
                onClick={() => void onRequest()}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-brand px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Solicitar anticipo
              </button>
            </div>
          )}
          <p className="mt-1 text-[10px] text-content-subtle">
            Solo el vendedor del lote puede solicitar. Se valida en el servidor.
          </p>
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
