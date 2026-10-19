import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublicRounds, type PublicRound } from "@/lib/wallet.functions";
import { RoundProgress } from "@/features/investor/RoundProgress";
import { ArrowRight, Calculator, Check } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { savePendingTicket, ROUND } from "@/features/investor/pendingTicket";
import {
  PROJECT_TERMS,
  REFERENCE_VALUATION_USD,
  SPV_ROUND_EQUITY_PCT,
  pctOfSpvCapital,
} from "@/features/investor/projectTerms";

const PROJECTS = [
  { slug: "cholqui" as const, name: "Cholqui", region: "Región Metropolitana · Cu–Au" },
  { slug: "losverdes" as const, name: "Los Verdes–Tilama", region: "Región de Coquimbo · Cu–Au" },
];

const STEPS = [
  { n: "01", t: "Ficha del proyecto", d: "Relieve 3D, satélite y data room." },
  { n: "02", t: "Simulación", d: "Acciones y participación, sin registro." },
  { n: "03", t: "KYC y firma", d: "Perfil en 3 pasos y contrato con QR." },
  { n: "04", t: "Mis inversiones", d: "Estado del ticket hasta la posición SPV." },
];

const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function MiningInvestShowcase() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState<(typeof PROJECTS)[number]["slug"]>("cholqui");
  const [amount, setAmount] = useState<number>(ROUND.minTicket);
  const [rounds, setRounds] = useState<PublicRound[]>([]);
  const current = rounds.find((r) => r.slug === slug);
  const minTicket = current?.minTicket ?? ROUND.minTicket;
  const sharePrice = current?.sharePrice ?? ROUND.sharePrice;
  const totalShares = current?.shares ?? ROUND.shares;
  const target = current?.target ?? ROUND.target;
  const shares = Math.floor(amount / sharePrice);
  const pct = (shares / totalShares) * 100;
  const valid = amount >= minTicket && amount <= target;
  const [rate, setRate] = useState(15);
  useEffect(() => {
    getPublicRounds()
      .then(setRounds)
      .catch(() => setRounds([]));
  }, []);
  const yearly = (amount * rate) / 100;

  const emit = () => {
    if (!valid) return;
    savePendingTicket({ slug, amount, shares });
    navigate({
      to: "/auth",
      search: { intent: "investor", mode: "signup", next: "/dashboard/investments" } as never,
    });
  };

  return (
    <section id="invertir" className="border-b border-hairline">
      <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
        <Eyebrow className="mb-3">Proyectos en explotación</Eyebrow>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight max-w-2xl">
          Dos faenas activas, una ronda por proyecto.
        </h2>
        <p className="mt-3 text-content-muted max-w-2xl text-sm">
          Explotación declarada por el titular de 5.000 a 15.000 t/mes en cada proyecto. Ronda de{" "}
          {usd(ROUND.target)} en {ROUND.shares.toLocaleString("es-CL")} acciones a{" "}
          {usd(ROUND.sharePrice)}.
        </p>

        <div className="mt-10 grid lg:grid-cols-[1fr_1fr] gap-6">
          <div className="grid gap-4">
            {PROJECTS.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setSlug(p.slug)}
                className={`text-left border p-5 bg-surface transition-colors ${
                  slug === p.slug
                    ? "border-accent-brand"
                    : "border-hairline hover:border-content-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-serif text-2xl">{p.name}</div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand border border-accent-brand px-2 py-0.5">
                    Ronda {usd(rounds.find((r) => r.slug === p.slug)?.target ?? ROUND.target)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-content-muted">{p.region}</div>
                <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                  Explotación · 5.000–15.000 t/mes
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-px bg-hairline border border-hairline text-left">
                  <div className="bg-surface p-2">
                    <dt className="text-[10px] text-content-muted">Hectáreas directas</dt>
                    <dd className="font-mono text-sm">
                      {PROJECT_TERMS[p.slug].hectares.direct.toLocaleString("es-CL")} ha
                    </dd>
                  </div>
                  <div className="bg-surface p-2">
                    <dt className="text-[10px] text-content-muted">Valuación ref.</dt>
                    <dd className="font-mono text-sm">{usd(REFERENCE_VALUATION_USD)}</dd>
                  </div>
                  <div className="bg-surface p-2">
                    <dt className="text-[10px] text-content-muted">Entrega</dt>
                    <dd className="text-[11px] leading-tight">
                      {PROJECT_TERMS[p.slug].delivery[0]}
                    </dd>
                  </div>
                </dl>
                <div className="mt-1 text-[10px] text-content-muted">
                  {PROJECT_TERMS[p.slug].hectares.detail} · distrito ~
                  {PROJECT_TERMS[p.slug].hectares.district.toLocaleString("es-CL")} ha · cifras
                  declaradas por el titular
                </div>
                {(() => {
                  const r = rounds.find((x) => x.slug === p.slug);
                  return r ? <RoundProgress round={r} compact /> : null;
                })()}
                <Link
                  to="/terminal/$slug"
                  params={{ slug: p.slug }}
                  search={{ tab: "mapa" }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
                >
                  Ver ficha y visor 3D <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </button>
            ))}
          </div>

          <div className="border border-hairline bg-surface-2 p-6">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted">
              <Calculator className="w-3.5 h-3.5" /> Simulación ·{" "}
              {PROJECTS.find((p) => p.slug === slug)?.name}
            </div>
            <label className="block mt-5 text-sm">
              Monto a invertir (USD) · desde {usd(minTicket)}
            </label>
            <input
              type="number"
              min={minTicket}
              step={sharePrice}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-2 w-full border border-hairline bg-surface px-3 py-2 font-mono text-lg"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[15000, 30000, 50000, 100000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="border border-hairline px-2.5 py-1 text-xs font-mono hover:border-accent-brand"
                >
                  {usd(v)}
                </button>
              ))}
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-content-muted">Acciones serie preferente</dt>
                <dd className="font-serif text-3xl">{shares.toLocaleString("es-CL")}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">Capital de la SPV</dt>
                <dd className="font-serif text-3xl">
                  {pctOfSpvCapital(shares, totalShares).toFixed(2)} %
                </dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">De la ronda</dt>
                <dd className="font-serif text-3xl">{pct.toFixed(2)} %</dd>
              </div>
            </dl>
            <p className="mt-2 font-mono text-[11px] text-content-muted">
              Valuación de referencia {usd(REFERENCE_VALUATION_USD)} · ronda ={" "}
              {SPV_ROUND_EQUITY_PCT} % del capital
            </p>
            <div className="mt-5 border-t border-hairline pt-4">
              <div className="flex items-center justify-between text-xs text-content-muted">
                <span>Escenario objetivo anual (UF +)</span>
                <span className="font-mono">{rate} %</span>
              </div>
              <input
                type="range"
                min={15}
                max={20}
                step={1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent-brand)]"
                aria-label="Escenario de rentabilidad"
              />
              <dl className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-content-muted">Escenario mensual</dt>
                  <dd className="font-serif text-2xl">{usd(yearly / 12)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Escenario anual</dt>
                  <dd className="font-serif text-2xl">{usd(yearly)}</dd>
                </div>
              </dl>
            </div>
            {!valid && (
              <p className="mt-3 text-xs text-accent-brand">
                Ticket mínimo {usd(minTicket)}, máximo {usd(target)}.
              </p>
            )}
            <button
              type="button"
              disabled={!valid}
              onClick={emit}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-accent-brand text-surface px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              Emitir ticket <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-3 text-[11px] text-content-muted leading-relaxed">
              Simulación referencial: escenario objetivo, no rentabilidad garantizada. No constituye
              oferta pública; la inversión minera conlleva riesgo de pérdida de capital. La emisión
              requiere registro, KYC y firma del contrato.
            </p>
          </div>
        </div>

        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border border-hairline">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-surface p-5">
              <div className="font-mono text-[10px] tracking-[0.2em] text-accent-brand">{s.n}</div>
              <div className="mt-2 font-serif text-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-accent-brand" /> {s.t}
              </div>
              <div className="mt-1 text-xs text-content-muted">{s.d}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
