import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Loader2, Ticket } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelTicket,
  createTicket,
  getProjectRound,
  signTicket,
  submitTicketPayment,
  type TicketRow,
} from "@/lib/tickets.functions";
import {
  TICKET_STATUS_LABEL,
  TICKET_STEPS,
  contractText,
  fmtMoney,
  sha256Hex,
} from "@/lib/investor/rounds";

export function TicketPanel({ spvCode, projectName }: { spvCode: string; projectName: string }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-content-subtle">
          Para emitir un ticket de inversión inicia sesión y completa tu perfil de inversionista.
        </p>
        <Link to="/auth" className="mt-3 inline-block text-sm text-accent-brand hover:underline">
          Iniciar sesión →
        </Link>
      </Shell>
    );
  }
  return <TicketPanelInner spvCode={spvCode} projectName={projectName} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-surface p-6">
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="w-4 h-4 text-accent-brand" />
        <Eyebrow>Ticket de inversión</Eyebrow>
      </div>
      {children}
    </section>
  );
}

function TicketPanelInner({ spvCode, projectName }: { spvCode: string; projectName: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getProjectRound);
  const createFn = useServerFn(createTicket);
  const key = ["project-round", spvCode];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getFn({ data: { projectCode: spvCode } }),
  });
  const [amount, setAmount] = useState("");
  const [risk, setRisk] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { projectCode: spvCode, amount: Number(amount), riskAccepted: true } }),
    onSuccess: () => {
      toast.success("Ticket enviado a revisión");
      setAmount("");
      setRisk(false);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear el ticket"),
  });

  if (isLoading || !data)
    return (
      <Shell>
        <Loader2 className="w-4 h-4 animate-spin text-content-subtle" />
      </Shell>
    );

  const spv = data.spv;
  if (!spv || !spv.tickets_open) {
    return (
      <Shell>
        <p className="text-sm text-content-subtle">
          La ronda de {projectName} aún no está abierta a tickets. El equipo GeoCapitals la abre
          cuando la sociedad, el precio por acción y la cuenta de depósito estén confirmados.
        </p>
      </Shell>
    );
  }

  const amt = Number(amount);
  const shares = spv.share_price && amt > 0 ? amt / Number(spv.share_price) : 0;
  const pct = spv.round_size
    ? Math.min(100, (data.committed / Number(spv.round_size)) * 100)
    : null;
  const active = data.mine.filter((t) => t.status !== "cancelled" && t.status !== "settled");

  return (
    <Shell>
      <h3 className="font-display text-xl text-content">{spv.legal_name}</h3>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat label="Precio por acción" value={fmtMoney(spv.share_price, spv.currency)} />
        <Stat label="Ticket mínimo" value={fmtMoney(spv.min_ticket, spv.currency)} />
        <Stat label="Meta de la ronda" value={fmtMoney(spv.round_size, spv.currency)} />
        <Stat
          label="Comprometido"
          value={`${fmtMoney(data.committed, spv.currency)}${pct != null ? ` · ${pct.toFixed(0)} %` : ""}`}
        />
      </div>

      {data.kycStatus !== "approved" && (
        <p className="mt-4 text-xs text-content-subtle border-l-2 border-accent-brand pl-3">
          {data.kycStatus
            ? "Tu perfil de inversionista está en revisión. Puedes enviar tu ticket; el contrato se emite al aprobarse el KYC."
            : "Aún no completas tu perfil de inversionista. Puedes enviar el ticket, pero el contrato requiere KYC aprobado."}{" "}
          <Link to="/dashboard" className="text-accent-brand hover:underline">
            Ir al perfil →
          </Link>
        </p>
      )}

      {active.length === 0 && (
        <div className="mt-5 grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs text-content-subtle mb-1" htmlFor="ticket-amount">
              Monto ({spv.currency})
            </label>
            <input
              id="ticket-amount"
              type="number"
              min={spv.min_ticket ?? 0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-hairline bg-surface px-3 py-2 font-mono text-sm"
            />
            <div className="mt-1 text-xs text-content-subtle font-mono">
              ≈ {shares.toLocaleString("es-CL", { maximumFractionDigits: 4 })} acciones
            </div>
            <label className="mt-3 flex gap-2 text-xs text-content-subtle">
              <input type="checkbox" checked={risk} onChange={(e) => setRisk(e.target.checked)} />
              Entiendo que es un proyecto en exploración, sin recursos ni reservas certificados (NI
              43-101 / JORC), y que no se garantiza rentabilidad.
            </label>
          </div>
          <button
            disabled={
              !risk || !(amt >= Number(spv.min_ticket ?? 0)) || amt <= 0 || create.isPending
            }
            onClick={() => create.mutate()}
            className="rounded-md bg-accent-brand px-4 py-2 text-sm text-surface disabled:opacity-40"
          >
            {create.isPending ? "Enviando…" : "Emitir ticket"}
          </button>
        </div>
      )}

      {data.mine.length > 0 && (
        <div className="mt-6 space-y-3">
          {data.mine.map((t) => (
            <MyTicket
              key={t.id}
              t={t}
              legalName={spv.legal_name}
              projectName={projectName}
              escrow={spv.escrow_instructions}
              onChange={() => qc.invalidateQueries({ queryKey: key })}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </div>
      <div className="font-mono text-content mt-0.5">{value}</div>
    </div>
  );
}

function MyTicket({
  t,
  legalName,
  projectName,
  escrow,
  onChange,
}: {
  t: TicketRow;
  legalName: string;
  projectName: string;
  escrow: string | null;
  onChange: () => void;
}) {
  const signFn = useServerFn(signTicket);
  const payFn = useServerFn(submitTicketPayment);
  const cancelFn = useServerFn(cancelTicket);
  const [sig, setSig] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const text = contractText({ ...t, legalName, projectName });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const stepIdx = TICKET_STEPS.indexOf(
    (t.status === "signed" ? "payment_pending" : t.status) as (typeof TICKET_STEPS)[number],
  );

  return (
    <div className="rounded-xl border border-hairline p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-sm text-content">{t.ticket_code}</div>
        <div className="text-xs text-accent-brand">{TICKET_STATUS_LABEL[t.status] ?? t.status}</div>
      </div>
      <div className="text-xs text-content-subtle font-mono mt-1">
        {fmtMoney(t.amount, t.currency)} · {Number(t.shares_allocated ?? 0).toLocaleString("es-CL")}{" "}
        acciones
      </div>
      {t.status !== "cancelled" && (
        <div className="mt-3 flex gap-1">
          {TICKET_STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${i <= stepIdx ? "bg-accent-brand" : "bg-hairline"}`}
              title={TICKET_STATUS_LABEL[s]}
            />
          ))}
        </div>
      )}

      {t.status === "contract_pending" && (
        <div className="mt-4">
          <pre className="whitespace-pre-wrap text-xs bg-surface-2 border border-hairline rounded p-3 text-content">
            {text}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <FileSignature className="w-4 h-4 text-accent-brand" />
            <input
              placeholder="Nombre completo como firma"
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              className="flex-1 min-w-[200px] rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm"
            />
            <button
              disabled={busy || sig.trim().length < 3}
              onClick={() =>
                run(
                  async () =>
                    signFn({
                      data: {
                        ticketId: t.id,
                        signatureName: sig.trim(),
                        contractHash: await sha256Hex(text),
                      },
                    }),
                  "Contrato firmado",
                )
              }
              className="rounded-md bg-accent-brand px-3 py-1.5 text-sm text-surface disabled:opacity-40"
            >
              Firmar
            </button>
          </div>
        </div>
      )}

      {t.status === "payment_pending" && (
        <div className="mt-4 text-sm">
          <div className="text-xs text-content-subtle">Instrucciones de depósito</div>
          <p className="whitespace-pre-wrap text-content mt-1">
            {escrow ?? "El equipo GeoCapitals te enviará la cuenta de depósito."}
          </p>
          {t.payment_proof_url ? (
            <p className="mt-2 text-xs text-content-subtle">
              Comprobante enviado; el equipo está verificando el pago.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                placeholder="N° de operación o enlace al comprobante"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm"
              />
              <button
                disabled={busy || proof.trim().length < 4}
                onClick={() =>
                  run(
                    () => payFn({ data: { ticketId: t.id, proof: proof.trim() } }),
                    "Comprobante enviado",
                  )
                }
                className="rounded-md bg-accent-brand px-3 py-1.5 text-sm text-surface disabled:opacity-40"
              >
                Enviar comprobante
              </button>
            </div>
          )}
        </div>
      )}

      {["draft", "pending_kyc", "contract_pending"].includes(t.status) && (
        <button
          disabled={busy}
          onClick={() =>
            run(
              () =>
                cancelFn({ data: { ticketId: t.id, reason: "Cancelado por el inversionista" } }),
              "Ticket cancelado",
            )
          }
          className="mt-3 text-xs text-content-subtle hover:text-content underline"
        >
          Cancelar ticket
        </button>
      )}
    </div>
  );
}
