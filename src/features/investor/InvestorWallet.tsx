import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Landmark, Clock, FileText, Download } from "lucide-react";
import { seriesForCode } from "@/features/investor/projectTerms";
import { getMyWallet, getPublicRounds, type PublicRound } from "@/lib/wallet.functions";
import { RoundProgress } from "@/features/investor/RoundProgress";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { TICKET_STATUS_LABEL, TICKET_STEPS } from "@/lib/investor/rounds";

type W = Awaited<ReturnType<typeof getMyWallet>>;
const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Cartola institucional: saldo, participaciones SPV por proyecto, órdenes en curso y avance de rondas. */
export function InvestorWallet() {
  const [w, setW] = useState<W | null>(null);
  const [rounds, setRounds] = useState<PublicRound[]>([]);
  const [busy, setBusy] = useState(false);
  const { usdClp } = useCurrency();
  useEffect(() => {
    getMyWallet()
      .then(setW)
      .catch(() => setW(null));
    getPublicRounds()
      .then(setRounds)
      .catch(() => setRounds([]));
  }, []);
  const clp = (n: number) =>
    usdClp ? `≈ CLP ${Math.round(n * usdClp).toLocaleString("es-CL")}` : undefined;

  const downloadStatement = async () => {
    if (!w) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      const holder = (u?.user_metadata?.full_name as string) || u?.email || "Inversionista";
      const { generateInvestmentStatement } = await import("@/lib/pdf/investmentStatementPdf");
      await generateInvestmentStatement({
        holder,
        positions: w.positions,
        tickets: w.tickets
          .filter((t) => !["settled", "cancelled", "rejected"].includes(t.status))
          .map((t) => ({ ...t, status: TICKET_STATUS_LABEL[t.status] ?? t.status })),
        usdClp,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-theme="im-light" className="mb-6 border border-hairline bg-surface text-content">
      <header className="p-5 border-b border-hairline flex flex-wrap items-center gap-2">
        <Landmark className="w-4 h-4 text-accent-brand" />
        <h2 className="font-serif text-xl">Cartola de posiciones</h2>
        <button
          type="button"
          onClick={() => void downloadStatement()}
          disabled={!w || busy}
          className="ml-auto inline-flex items-center gap-1.5 border border-accent-brand px-3 py-1.5 text-xs text-accent-brand hover:bg-accent-brand hover:text-surface disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> {busy ? "Generando…" : "Cartola PDF"}
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline">
        <Kpi
          label="Capital en posiciones"
          value={usd(w?.totals.invested ?? 0)}
          note={clp(w?.totals.invested ?? 0)}
        />
        <Kpi
          label="Acciones serie preferente"
          value={(w?.totals.shares ?? 0).toLocaleString("es-CL")}
        />
        <Kpi
          label="Órdenes en curso"
          value={usd(w?.totals.pending ?? 0)}
          note={clp(w?.totals.pending ?? 0)}
        />
      </div>

      <div className="p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted mb-3">
          Activos
        </h3>
        {!w || w.positions.length === 0 ? (
          <p className="text-sm text-content-muted">
            Aún no tienes participaciones confirmadas. Aparecerán aquí cuando el equipo liquide tu
            ticket.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {w.positions.map((p) => (
              <article key={p.id} className="border border-hairline p-4 bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent-brand flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" />{" "}
                    {seriesForCode(p.project === "Cholqui" ? "CHOLQUI" : "LV")}
                  </span>
                  <span className="text-[11px] text-content-muted">Explotación</span>
                </div>
                <div className="mt-2 font-serif text-lg">{p.project}</div>
                <div className="mt-2 font-serif text-2xl">
                  {p.shares.toLocaleString("es-CL")} acciones
                </div>
                <div className="text-xs text-content-muted">
                  {usd(p.amount_paid)}
                  {p.pctOfSpv != null ? ` · ${p.pctOfSpv.toFixed(3)} % de la SPV` : ""}
                </div>
                {p.document_url && (
                  <a
                    href={p.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-accent-brand hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" /> Certificado
                  </a>
                )}
              </article>
            ))}
          </div>
        )}

        {w && w.tickets.length > 0 && (
          <>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted mt-6 mb-3">
              Órdenes
            </h3>
            <ul className="divide-y divide-hairline border border-hairline">
              {w.tickets.map((t) => {
                const idx = TICKET_STEPS.indexOf(
                  (t.status === "signed"
                    ? "payment_pending"
                    : t.status) as (typeof TICKET_STEPS)[number],
                );
                return (
                  <li key={t.id} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-mono text-xs text-content-muted mr-2">
                          {t.ticket_code}
                        </span>
                        {t.project} · {usd(t.amount)}
                      </span>
                      <span className="text-xs inline-flex items-center gap-1 text-accent-brand">
                        <Clock className="w-3 h-3" /> {TICKET_STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    {t.status !== "cancelled" && idx >= 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {TICKET_STEPS.map((s, i) => (
                          <div
                            key={s}
                            className={`h-1 ${i <= idx ? "bg-accent-brand" : "bg-hairline"}`}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {rounds.length > 0 && (
          <>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted mt-6 mb-3">
              Rondas activas
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {rounds.map((r) => (
                <div key={r.code} className="border border-hairline p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-lg">{r.name}</span>
                    <Link
                      to="/terminal/$slug"
                      params={{ slug: r.slug }}
                      search={{ tab: "mapa" }}
                      className="text-xs text-accent-brand hover:underline"
                    >
                      Ver proyecto
                    </Link>
                  </div>
                  <RoundProgress round={r} compact />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-[11px] text-content-muted">{label}</div>
      <div className="font-serif text-2xl mt-1">{value}</div>
      {note && <div className="text-[11px] text-content-muted font-mono mt-0.5">{note}</div>}
    </div>
  );
}
