import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Target, ListChecks, ShieldCheck, PieChart } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import { getPublicFundraise } from "@/lib/fundraise.functions";
import {
  FUNDRAISE_INSTRUMENT_LABELS,
  totalAllocationPct,
  impliedPostMoneyUsd,
  impliedPreMoneyUsd,
  resolveScenarios,
  ticketOutcomeUsd,
  PROJECT_OPERATOR,
  type FundraiseInstrument,
} from "@/lib/fundraise";

// Página PÚBLICA de solo lectura: la ficha de levantamiento de capital de un
// proyecto, compartible por token. Lee de DB (project_fundraises), no del TS
// estático. Términos referenciales, sujetos a DD/NDA.

export const Route = createFileRoute("/proyecto/$token")({
  head: () => ({
    meta: [{ title: "Ficha de proyecto — Geocapitals" }, { name: "robots", content: "noindex" }],
  }),
  component: PublicProjectSheet,
});

const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

function PublicProjectSheet() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getPublicFundraise);
  const { data, isLoading } = useQuery({
    queryKey: ["public-fundraise", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  return (
    <div className="brand-light min-h-screen flex flex-col bg-surface">
      <MarketingHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
        {isLoading ? (
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        ) : !data ? (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <h1 className="font-display text-2xl text-content mb-2">Ficha no disponible</h1>
            <p className="text-sm text-content-subtle">
              Este enlace no corresponde a una ficha de proyecto pública y activa.
            </p>
          </div>
        ) : (
          <Sheet data={data} />
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}

function Sheet({ data }: { data: NonNullable<Awaited<ReturnType<typeof getPublicFundraise>>> }) {
  const { project: p, fundraise: f } = data;
  const post = impliedPostMoneyUsd(f.roundSizeUsd, f.equityOfferedPct);
  const pre = impliedPreMoneyUsd(f.roundSizeUsd, f.equityOfferedPct);
  const allocTotal = totalAllocationPct(f.useOfFunds);

  return (
    <>
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-brand mb-2">
        <TrendingUp className="w-4 h-4" /> Oportunidad de inversión
      </div>
      <h1 className="font-display text-2xl lg:text-3xl text-content">{p.name}</h1>
      <div className="text-sm text-content-subtle">
        <span className="font-mono">{p.code}</span>
        {p.commodity ? ` · ${p.commodity}` : ""}
        {p.region ? ` · ${p.region}` : ""}
        {p.country ? ` · ${p.country}` : ""}
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent-brand/30 bg-accent-brand/5 px-2.5 py-1 text-[12px] text-content">
        <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
        Operado por <strong>{PROJECT_OPERATOR}</strong>
      </div>

      {/* Valuación */}
      {(f.valuationLowUsd != null || f.valuationHighUsd != null || post != null) && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-hairline bg-white p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              Valuación referencial
            </div>
            <div className="text-lg font-semibold text-content mt-0.5">
              {f.valuationLowUsd != null || f.valuationHighUsd != null
                ? `${usd(f.valuationLowUsd)} – ${usd(f.valuationHighUsd)}`
                : usd(post)}
            </div>
            {f.valuationMethod && (
              <div className="text-[11px] text-content-subtle mt-0.5">{f.valuationMethod}</div>
            )}
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              Post-money implícita
            </div>
            <div className="text-lg font-semibold text-content mt-0.5">{usd(post)}</div>
            {pre != null && (
              <div className="text-[11px] text-content-subtle mt-0.5">Pre-money {usd(pre)}</div>
            )}
          </div>
        </div>
      )}

      {f.highlights.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {f.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-content">
              <Target className="w-3.5 h-3.5 text-accent-brand mt-0.5 shrink-0" /> {h}
            </li>
          ))}
        </ul>
      )}

      {/* La ronda */}
      <div className="mt-5 rounded-xl border border-hairline bg-white p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          La ronda
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Monto a levantar" value={usd(f.roundSizeUsd)} strong />
          <Field label="Ticket mínimo" value={usd(f.minTicketUsd)} />
          <Field
            label="Instrumento"
            value={
              f.instrument ? FUNDRAISE_INSTRUMENT_LABELS[f.instrument as FundraiseInstrument] : "—"
            }
          />
          <Field
            label="% ofrecido"
            value={f.equityOfferedPct != null ? `${f.equityOfferedPct}%` : "—"}
          />
          <Field
            label="Horizonte"
            value={f.horizonYears != null ? `${f.horizonYears} años` : "—"}
          />
        </div>
      </div>

      {/* Plan de inversión · retorno proyectado */}
      <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          <TrendingUp className="w-3.5 h-3.5" /> Plan de inversión · retorno proyectado
        </div>
        <p className="text-[13px] text-content-subtle mb-3">
          Invierte desde <strong className="text-content">{usd(f.minTicketUsd)}</strong>
          {f.instrument
            ? ` vía ${FUNDRAISE_INSTRUMENT_LABELS[f.instrument as FundraiseInstrument]}`
            : ""}
          . Retorno proyectado del ticket mínimo
          {f.horizonYears != null ? ` al horizonte de ${f.horizonYears} años` : " al horizonte"}:
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {resolveScenarios(f.scenarios).map((s) => (
            <div key={s.key} className="rounded-lg border border-hairline p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-content">{s.label}</span>
                <span className="font-mono text-sm text-accent-brand">{s.multiple}×</span>
              </div>
              <div className="text-sm font-semibold text-content mt-1">
                {usd(ticketOutcomeUsd(f.minTicketUsd ?? 0, s))}
              </div>
              {s.note && <div className="text-[11px] text-content-subtle mt-1">{s.note}</div>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-content-subtle mt-2">
          Múltiplos referenciales (MOIC) sobre el capital invertido; no garantizan resultados.
        </p>
      </div>

      {/* Uso de fondos */}
      {f.useOfFunds.length > 0 && (
        <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            <PieChart className="w-3.5 h-3.5" /> Uso de fondos
          </div>
          <div className="space-y-2">
            {f.useOfFunds.map((u, i) => (
              <div key={i}>
                <div className="flex justify-between text-[13px] mb-0.5">
                  <span className="text-content">{u.label || "—"}</span>
                  <span className="font-mono text-content-subtle">{u.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-accent-brand"
                    style={{ width: `${Math.min(100, Math.max(0, u.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {allocTotal < 100 && (
            <div className="mt-2 text-[11px] text-content-subtle">Asignado {allocTotal}%.</div>
          )}
        </div>
      )}

      {/* Estructura */}
      {f.financingStructure && (
        <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
            Estructura de financiamiento
          </div>
          <p className="text-[13px] text-content whitespace-pre-wrap">{f.financingStructure}</p>
        </div>
      )}

      {/* Hitos */}
      {f.milestones.length > 0 && (
        <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            <ListChecks className="w-3.5 h-3.5" /> Hitos
          </div>
          <div className="space-y-2">
            {f.milestones.map((m, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-accent-brand shrink-0 w-16">{m.when || "—"}</span>
                <span className="text-content">{m.what}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 text-[11px] font-mono text-content-subtle">
        <ShieldCheck className="w-3.5 h-3.5 text-accent-brand mt-0.5 shrink-0" />
        Términos económicos referenciales, no constituyen oferta pública. Sujetos a due diligence,
        NDA y acuerdo definitivo. Ficha compartida vía Geocapitals.
      </div>
    </>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </div>
      <div className={`text-content ${strong ? "font-semibold text-base" : ""}`}>{value}</div>
    </div>
  );
}
