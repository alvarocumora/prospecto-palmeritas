import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { BrandButton } from "@/components/brand";
import { ContentState } from "@/components/ui-system";
import { confirmedPositionSummary, money } from "./investmentPresentation";
import { Landmark, Clock, FileText, Download } from "lucide-react";
import { seriesForCode } from "@/features/investor/projectTerms";
import { getMyWallet, getPublicRounds, type PublicRound } from "@/lib/wallet.functions";
import { RoundProgress } from "@/features/investor/RoundProgress";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { TICKET_STATUS_LABEL, TICKET_STEPS } from "@/lib/investor/rounds";

type W = Awaited<ReturnType<typeof getMyWallet>>;

/** Cartola institucional: saldo, participaciones SPV por proyecto, órdenes en curso y avance de rondas. */
export function InvestorWallet() {
  const [w, setW] = useState<W | null>(null);
  const [rounds, setRounds] = useState<PublicRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [roundError, setRoundError] = useState(false);
  const [contractBusy, setContractBusy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { usdClp } = useCurrency();
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try { setW(await getMyWallet()); } catch { setW(null); setError(true); }
    finally { setLoading(false); }
  }, []);
  const loadRounds = useCallback(async () => {
    setRoundError(false);
    try { setRounds(await getPublicRounds()); } catch { setRounds([]); setRoundError(true); }
  }, []);
  useEffect(() => { void load(); void loadRounds(); }, [load, loadRounds]);
  const confirmed = w ? confirmedPositionSummary(w.positions) : null;
  const capital = confirmed ? [...confirmed.capital].map(([c, n]) => money(n, c)).join(" · ") || "Sin posiciones" : "—";
  const statementCurrencySupported = (confirmed?.positions ?? []).every(p => p.currency === "USD") && (w?.tickets ?? []).every(t => t.currency === "USD");
  const pending = w?.tickets.filter(t => !["settled", "cancelled", "rejected"].includes(t.status)) ?? [];
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
        positions: confirmed?.positions ?? [],
        tickets: w.tickets
          .filter((t) => !["settled", "cancelled", "rejected"].includes(t.status))
          .map((t) => ({ ...t, status: TICKET_STATUS_LABEL[t.status] ?? t.status })),
        usdClp,
      });
    } catch {
      const { toast } = await import("sonner"); toast.error("No pudimos generar la cartola. Reintenta.");
    } finally {
      setBusy(false);
    }
  };

  const downloadContract = async (ticketId: string, project: string) => {
    setContractBusy(ticketId);
    try {
      const { data: t, error } = await supabase
        .from("investment_tickets")
        .select("*")
        .eq("id", ticketId)
        .single();
      if (error || !t) throw new Error("No se pudo leer el ticket");
      const { data: spv } = await supabase
        .from("spv_entities")
        .select("legal_name")
        .eq("id", t.spv_id ?? "")
        .maybeSingle();
      let signatureImage: string | null = null;
      try {
        const { getTicketSignatureUrl } = await import("@/lib/ticketSignature.functions");
        const { url } = await getTicketSignatureUrl({ data: { ticketId } });
        if (url) {
          const blob = await (await fetch(url)).blob();
          signatureImage = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
        }
      } catch {
        /* sin trazo almacenado */
      }
      const { downloadInvestmentContractPdf } = await import("@/lib/pdf/investmentContractPdf");
      await downloadInvestmentContractPdf({
        t: t as never,
        legalName: spv?.legal_name ?? "Valle Escondido SpA",
        projectName: project,
        projectSlug: project.toLowerCase().includes("verdes") ? "losverdes" : "cholqui",
        signatureImage,
      });
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error(e instanceof Error ? e.message : "Error al generar el contrato");
    } finally { setContractBusy(null); }
  };

  return (
    <section
      id="cartola"
      data-theme="im-light"
      className="mb-8 scroll-mt-20 overflow-hidden rounded-xl border border-hairline bg-surface-3 text-content"
    >
      <header className="p-5 border-b border-hairline flex flex-wrap items-center gap-2">
        <Landmark className="w-4 h-4 text-accent-brand" />
        <h2 className="font-serif text-xl">Cartola de posiciones</h2>
        <BrandButton variant="outline"
          type="button"
          onClick={() => void downloadStatement()}
          disabled={!w || busy || loading || error || !statementCurrencySupported}
          title={!w ? "Consulta tus posiciones antes de descargar" : !statementCurrencySupported ? "La cartola PDF actual solo admite USD; consulta certificados individuales" : "Descargar cartola de inversiones"}
          className="ml-auto inline-flex items-center gap-1.5 border border-accent-brand px-3 min-h-11 py-1.5 text-xs text-accent-brand hover:bg-accent-brand hover:text-surface disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> {busy ? "Generando…" : "Cartola PDF"}
        </BrandButton>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline">
        <Kpi
          label="Capital aportado · confirmado"
          value={error ? "No disponible" : capital}
          note={confirmed?.capital.size === 1 && confirmed.capital.has("USD") ? clp(confirmed.capital.get("USD") ?? 0) : loading ? "Consultando…" : "Capital histórico, no valor de mercado"}
        />
        <Kpi
          label="Acciones serie preferente"
          value={w ? confirmed?.shares.toLocaleString("es-CL") ?? "—" : "—"}
        />
        <Kpi
          label="Órdenes en curso"
          value={w ? `${pending.length} tickets` : "—"}
          note={w ? "No son posiciones confirmadas" : loading ? "Consultando…" : "No disponible"}
        />
      </div>

      <div className="p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-muted mb-3">
          Mis posiciones confirmadas
        </h3>
        {error ? (
          <ContentState
            kind="error"
            title="No pudimos consultar tus posiciones"
            description="Un error de consulta no equivale a no tener inversiones."
            action={{ label: "Reintentar", onClick: () => void load() }}
          />
        ) : loading ? (
          <ContentState kind="loading" title="Consultando tus posiciones…" />
        ) : !confirmed || confirmed.positions.length === 0 ? (
          <ContentState
            kind="empty"
            title="Sin posiciones confirmadas"
            description="Las participaciones se mostrarán cuando el equipo liquide y confirme tu ticket."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {confirmed.positions.map((p) => (
              <article key={p.id} className="min-w-0 rounded-lg border border-hairline p-5 bg-surface-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent-brand flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" /> {p.slug === "cholqui" ? seriesForCode("CHOLQUI") : p.slug === "losverdes" ? seriesForCode("LV") : "Serie SPV · por verificar"}
                  </span>
                  <span className="text-[11px] text-content-muted">Explotación</span>
                </div>
                <div className="mt-2 font-serif text-lg">{p.project}</div>
                <div className="mt-2 font-serif text-2xl">
                  {p.shares.toLocaleString("es-CL")} acciones
                </div>
                <div className="text-xs text-content-muted">
                  Capital aportado: {money(p.amount_paid, p.currency)}
                  {p.pctOfSpv != null ? ` · ${p.pctOfSpv.toFixed(3)} % de la SPV` : ""}
                </div>
                {p.document_url && (
                  <a
                    href={p.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs text-accent-brand hover:underline"
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
              Órdenes pendientes e historial
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
                        {t.project} · {money(t.amount, t.currency)}
                      </span>
                      <span className="text-xs inline-flex items-center gap-3 text-accent-brand">
                        {["signed", "payment_pending", "settled"].includes(t.status) && (
                          <BrandButton variant="outline"
                            type="button"
                            onClick={() => void downloadContract(t.id, t.project)}
                            disabled={contractBusy === t.id}
                            className="inline-flex min-h-11 items-center gap-1 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> {contractBusy === t.id ? "Generando…" : "Contrato firmado"}
                          </BrandButton>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {TICKET_STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </span>
                    </div>
                    {t.status !== "cancelled" && idx >= 0 && (
                      <ol aria-label="Avance del ticket" className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {TICKET_STEPS.map((s, i) => (
                          <li key={s} className="min-w-0 text-[10px] text-content-muted"><div className={`mb-1 h-1 ${i <= idx ? "bg-accent-brand" : "bg-hairline"}`} />{TICKET_STATUS_LABEL[s] ?? s}</li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {!loading && !error && pending.length === 0 && <p className="mt-5 text-sm text-content-muted">Sin órdenes pendientes.</p>}
        <div className="mt-8 border-t border-hairline pt-5"><h3 className="font-serif text-xl">Documentos y cartola PDF</h3><p className="mt-2 text-sm text-content-muted">Certificados junto a cada posición; contratos firmados junto a cada orden. La cartola PDF reúne las posiciones consultadas.</p></div>
        {!statementCurrencySupported && <p role="status" className="mt-3 text-xs text-content-muted">La cartola PDF actual solo admite USD. Consulta los certificados individuales para otras monedas.</p>}
        <p className="mt-5 text-[11px] text-content-muted">Inversión privada e ilíquida; riesgo de pérdida total. El capital aportado no es una valoración de mercado ni acredita rentabilidad. Sin recursos certificados NI 43-101/JORC.</p>
        {roundError && <div role="alert" className="mt-4">No pudimos cargar las rondas. <BrandButton variant="outline" onClick={() => void loadRounds()}>Reintentar</BrandButton></div>}
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
