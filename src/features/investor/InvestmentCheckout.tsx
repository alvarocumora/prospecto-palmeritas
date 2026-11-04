/**
 * Checkout de inversión unificado: un solo asistente de 4 pasos abierto desde
 * landing, terminal y deck. No crea lógica nueva: los pasos 3–4 usan el
 * TicketPanel real (RPC ticket_submit_for_review / sign / submit_payment).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { TicketPanel } from "@/features/terminal/TicketPanel";
import { INVESTABLE_PROJECTS } from "@/lib/investor/rounds";
import { ROUND, savePendingTicket } from "@/features/investor/pendingTicket";
import { checkoutQuote, PRESETS, type CheckoutSlug } from "./checkoutQuote";

const STEPS = ["Simulación", "Identidad", "Contrato", "Fondos"] as const;
const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function InvestmentCheckout({
  open,
  onOpenChange,
  initialSlug = "cholqui",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialSlug?: CheckoutSlug;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState<CheckoutSlug>(initialSlug);
  const [amount, setAmount] = useState<number>(ROUND.minTicket);
  useEffect(() => {
    if (open) {
      setSlug(initialSlug);
      setStep(0);
    }
  }, [open, initialSlug]);

  const q = checkoutQuote(amount);
  const project = INVESTABLE_PROJECTS.find((p) => p.slug === slug)!;

  const continueToIdentity = () => {
    if (!q.valid) return;
    if (user) return setStep(2);
    setStep(1);
  };

  const goSignup = () => {
    savePendingTicket({ slug, amount, shares: q.shares });
    onOpenChange(false);
    navigate({
      to: "/auth",
      search: { intent: "investor", mode: "signup", next: "/dashboard/investments" } as never,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-hairline bg-surface p-0">
        <header className="bg-surface-inverse px-6 py-5 text-content-inverse">
          <DialogTitle className="font-serif text-2xl">Invertir en una ronda</DialogTitle>
          <DialogDescription className="mt-1 text-xs opacity-75">
            Acciones de la SPV emisora Valle Escondido SpA · contrato con hash y firma en pantalla
          </DialogDescription>
          <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Pasos">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step || (step >= 2 && i === 3 && false);
              return (
                <li key={s} aria-current={active ? "step" : undefined}>
                  <div
                    className={`h-1 rounded ${i <= step ? "bg-im-gold" : "bg-content-inverse/20"}`}
                  />
                  <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                    {done ? <Check className="h-3 w-3 text-im-gold" /> : `0${i + 1}`} {s}
                  </div>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="p-6">
          {step === 0 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-xs font-mono uppercase tracking-wider text-content-subtle">
                  Proyecto
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {INVESTABLE_PROJECTS.map((p) => (
                    <Choice key={p.slug} on={slug === p.slug} onClick={() => setSlug(p.slug)}>
                      <span className="font-serif text-base">{p.name}</span>
                      <span className="block text-xs text-content-subtle">
                        {p.slug === "cholqui" ? "Cu · Melipilla, RM" : "Cu-Mo · Coquimbo"}
                      </span>
                    </Choice>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-mono uppercase tracking-wider text-content-subtle">
                  Monto (USD) · mínimo {usd(ROUND.minTicket)}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((v) => (
                    <Choice key={v} on={amount === v} onClick={() => setAmount(v)} compact>
                      {usd(v)}
                    </Choice>
                  ))}
                </div>
                <input
                  aria-label="Monto personalizado en USD"
                  type="number"
                  min={ROUND.minTicket}
                  step={ROUND.sharePrice}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="mt-3 h-11 w-full rounded-md border border-hairline bg-surface px-3 font-mono text-sm"
                />
              </fieldset>

              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-hairline bg-hairline text-sm">
                <Kpi l="Acciones SPV" v={q.shares.toLocaleString("es-CL")} />
                <Kpi l="% de la ronda" v={`${q.pctOfRound.toFixed(2)} %`} />
                <Kpi l="Precio/acción" v={usd(ROUND.sharePrice)} />
              </dl>
              {!q.valid && (
                <p role="alert" className="text-xs text-destructive">
                  {q.reason}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-content-subtle">
                Proyecto en explotación declarada por el titular, sin recursos ni reservas
                certificados (NI 43-101 / JORC). No se garantiza rentabilidad. ¿Prefieres un mutuo
                con respaldo inmobiliario?{" "}
                <Link
                  to="/inversion-colateral"
                  className="text-accent-brand underline"
                  onClick={() => onOpenChange(false)}
                >
                  Ver programa de colateral
                </Link>
                .
              </p>
              <div className="flex justify-end">
                <Primary disabled={!q.valid || loading} onClick={continueToIdentity}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Primary>
              </div>
            </div>
          )}

          {step === 1 && !user && (
            <div className="space-y-4">
              <h3 className="font-serif text-xl">Crea tu acceso de inversionista</h3>
              <p className="text-sm text-content-muted">
                Guardamos tu selección ({project.name}, {usd(amount)} · {q.shares} acciones). Al
                registrarte completas tu perfil (RUT o pasaporte y declaración) y retomas el ticket
                en tu portafolio.
              </p>
              <div className="flex justify-between">
                <Secondary onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" /> Volver
                </Secondary>
                <Primary onClick={goSignup}>
                  Registrarme y continuar <ArrowRight className="h-4 w-4" />
                </Primary>
              </div>
            </div>
          )}

          {step >= 2 && user && (
            <div>
              <Secondary onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Cambiar proyecto o monto
              </Secondary>
              <TicketPanel
                key={`${project.spvCode}-${amount}`}
                spvCode={project.spvCode}
                projectName={project.name}
                initialAmount={amount}
              />
              <div className="mt-4 text-right">
                <Link
                  to="/dashboard/investments"
                  onClick={() => onOpenChange(false)}
                  className="text-sm text-accent-brand underline"
                >
                  Ir a mi portafolio y cartola →
                </Link>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Botón reutilizable que abre el checkout. */
export function InvestNowButton({
  slug,
  className,
  children = "Invertir ahora",
}: {
  slug?: CheckoutSlug;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-11 items-center gap-2 rounded-sm bg-im-gold px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-inverse hover:opacity-90"
        }
      >
        {children}
      </button>
      <InvestmentCheckout open={open} onOpenChange={setOpen} initialSlug={slug} />
    </>
  );
}

function Choice({
  on,
  onClick,
  children,
  compact,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-md border text-left ${compact ? "px-4 font-mono text-sm" : "p-3"} ${
        on ? "border-accent-brand bg-accent-brand/5" : "border-hairline hover:border-content-subtle"
      }`}
    >
      {children}
    </button>
  );
}

function Kpi({ l, v }: { l: string; v: string }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-content-subtle">{l}</dt>
      <dd className="mt-0.5 font-mono text-content">{v}</dd>
    </div>
  );
}

function Primary(props: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent-brand px-5 text-sm font-medium text-accent-brand-contrast disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

function Secondary(props: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-content-muted hover:text-content"
    >
      {props.children}
    </button>
  );
}
