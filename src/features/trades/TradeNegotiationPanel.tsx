// Panel de negociación estructurada de términos (Trades).
//
// Consume los RPC:
//   - get_trade_negotiation(p_trade_id)             → hilo (timeline)
//   - propose_trade_terms(p_trade_id, p_party, …)    → oferta / contra-oferta
//   - respond_trade_terms(p_offer_id, 'accept'|'reject', p_note) → aceptar/rechazar
//
// Se usa en el detalle del trade autenticado (staff / contraparte interna).
// Al aceptar, el backend vuelca los términos a commodity_trades y el detalle
// se refresca vía onAccepted() → invalidación de la query del trade.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Handshake,
  Reply,
  Check,
  X,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ship,
  Anchor,
  Calendar,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type NegotiationRow = {
  id: string;
  party: "buyer" | "seller" | "geocapitals";
  price_usd_t: number | null;
  quantity_t: number | null;
  incoterm: string | null;
  port_loading: string | null;
  port_discharge: string | null;
  delivery_from: string | null;
  delivery_to: string | null;
  payment_terms: string | null;
  shipping_notes: string | null;
  valid_until: string | null;
  message: string | null;
  status: "proposed" | "accepted" | "rejected" | "countered" | "withdrawn" | "superseded";
  replies_to: string | null;
  created_at: string;
};

const INCOTERMS = ["CIF", "FOB", "CFR", "DAP", "DDP"] as const;
type Party = "buyer" | "seller" | "geocapitals";

const PARTY_LABEL: Record<Party, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  geocapitals: "Geocapitals",
};

const STATUS_STYLE: Record<NegotiationRow["status"], { label: string; cls: string }> = {
  proposed: { label: "Abierta", cls: "border-blue-300 bg-blue-50 text-blue-700" },
  accepted: { label: "Aceptada", cls: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rechazada", cls: "border-red-300 bg-red-50 text-red-700" },
  countered: { label: "Contra-ofertada", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  withdrawn: { label: "Retirada", cls: "border-neutral-300 bg-neutral-50 text-neutral-600" },
  superseded: { label: "Superada", cls: "border-neutral-300 bg-neutral-50 text-neutral-500" },
};

const usd = (n: number | null) =>
  n != null ? `US$ ${Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 })}/t` : "—";
const tons = (n: number | null) => (n != null ? `${Number(n).toLocaleString("es-CL")} t` : "—");
const fdate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-CL") : "—");

type ProposeArgs = {
  p_trade_id: string;
  p_party: Party;
  p_price_usd_t: number | null;
  p_quantity_t: number | null;
  p_incoterm: string | null;
  p_port_loading: string | null;
  p_port_discharge: string | null;
  p_delivery_from: string | null;
  p_delivery_to: string | null;
  p_payment_terms: string | null;
  p_shipping_notes: string | null;
  p_valid_until: string | null;
  p_message: string | null;
  p_replies_to: string | null;
};

export function TradeNegotiationPanel({
  tradeId,
  defaultParty = "geocapitals",
  onAccepted,
}: {
  tradeId: string;
  /** Rol con el que se firmarán las propuestas creadas desde este panel. */
  defaultParty?: Party;
  onAccepted?: () => void;
}) {
  const qc = useQueryClient();
  const [replyTo, setReplyTo] = useState<NegotiationRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const queryKey = ["trade-negotiation", tradeId] as const;
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<NegotiationRow[]> => {
      const { data, error } = await (supabase.rpc as any)("get_trade_negotiation", {
        p_trade_id: tradeId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as NegotiationRow[];
    },
    staleTime: 15_000,
    refetchInterval: 45_000,
  });

  const rows = data ?? [];
  const openOffers = useMemo(() => rows.filter((r) => r.status === "proposed"), [rows]);

  const submitPropose = async (args: ProposeArgs) => {
    setBusy("propose");
    try {
      const { error } = await (supabase.rpc as any)("propose_trade_terms", args);
      if (error) throw new Error(error.message);
      toast.success(args.p_replies_to ? "Contra-oferta enviada" : "Oferta enviada");
      setFormOpen(false);
      setReplyTo(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la propuesta.");
    } finally {
      setBusy(null);
    }
  };

  const respond = async (offer: NegotiationRow, action: "accept" | "reject") => {
    const note =
      action === "reject" ? (window.prompt("Motivo del rechazo (opcional)") ?? null) : null;
    if (action === "accept") {
      const ok = window.confirm(
        "¿Aceptar esta propuesta? Los términos (precio, cantidad, Incoterm, pago) se aplicarán al trade y se superarán otras ofertas abiertas.",
      );
      if (!ok) return;
    }
    setBusy(offer.id);
    try {
      const { error } = await (supabase.rpc as any)("respond_trade_terms", {
        p_offer_id: offer.id,
        p_action: action,
        p_note: note,
      });
      if (error) throw new Error(error.message);
      toast.success(action === "accept" ? "Propuesta aceptada" : "Propuesta rechazada");
      await refetch();
      if (action === "accept") {
        onAccepted?.();
        void qc.invalidateQueries({ queryKey: ["trade-tracking", tradeId] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo responder la propuesta.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl flex items-center gap-2">
            <Handshake className="w-4 h-4 text-primary" />
            Negociación de términos
          </h2>
          <p className="text-xs text-muted-foreground">
            Oferta / contra-oferta con precio, cantidad, Incoterm, puertos, fechas, pago y envío. Al
            aceptar, los términos se vuelcan al trade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openOffers.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider rounded-full border border-blue-300 bg-blue-50 text-blue-700 px-2 py-0.5">
              {openOffers.length} abierta(s)
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setReplyTo(null);
              setFormOpen((v) => !v);
            }}
            className="text-xs px-3 py-1.5 rounded border border-[hsl(var(--im-hairline,var(--border)))] hover:bg-neutral-50 inline-flex items-center gap-1"
          >
            {formOpen && !replyTo ? (
              <>
                <ChevronUp className="w-3 h-3" /> Cerrar
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Nueva oferta
              </>
            )}
          </button>
        </div>
      </header>

      {formOpen && (
        <ProposeForm
          tradeId={tradeId}
          defaultParty={defaultParty}
          replyTo={replyTo}
          busy={busy === "propose"}
          onCancel={() => {
            setFormOpen(false);
            setReplyTo(null);
          }}
          onSubmit={submitPropose}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando hilo de negociación…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[hsl(var(--im-hairline,var(--border)))] p-4 text-sm text-muted-foreground">
          Aún no hay propuestas. Envía la primera oferta para iniciar la negociación estructurada.
        </div>
      ) : (
        <ol className="relative border-l border-[hsl(var(--im-hairline,var(--border)))] ml-2 space-y-4">
          {rows.map((r) => {
            const st = STATUS_STYLE[r.status];
            const isOpen = r.status === "proposed";
            return (
              <li key={r.id} className="pl-4 relative">
                <span
                  className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 bg-white ${
                    r.status === "accepted"
                      ? "border-emerald-500"
                      : r.status === "rejected"
                        ? "border-red-400"
                        : r.status === "countered"
                          ? "border-amber-500"
                          : isOpen
                            ? "border-blue-500"
                            : "border-neutral-300"
                  }`}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("es-CL")}
                  </span>
                  <span className="text-sm font-semibold">{PARTY_LABEL[r.party]}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${st.cls}`}
                  >
                    {st.label}
                  </span>
                  {r.replies_to && (
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <Reply className="w-3 h-3" /> contra-oferta
                    </span>
                  )}
                </div>

                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <Field label="Precio" value={usd(r.price_usd_t)} />
                  <Field label="Cantidad" value={tons(r.quantity_t)} />
                  <Field label="Incoterm" value={r.incoterm ?? "—"} />
                  <Field
                    label="Válida hasta"
                    icon={<Calendar className="w-3 h-3" />}
                    value={fdate(r.valid_until)}
                  />
                  {(r.port_loading || r.port_discharge) && (
                    <Field
                      label="Puertos"
                      icon={<Anchor className="w-3 h-3" />}
                      value={`${r.port_loading ?? "—"} → ${r.port_discharge ?? "—"}`}
                      wide
                    />
                  )}
                  {(r.delivery_from || r.delivery_to) && (
                    <Field
                      label="Entrega"
                      icon={<Ship className="w-3 h-3" />}
                      value={`${fdate(r.delivery_from)} → ${fdate(r.delivery_to)}`}
                      wide
                    />
                  )}
                  {r.payment_terms && (
                    <Field
                      label="Pago"
                      icon={<CreditCard className="w-3 h-3" />}
                      value={r.payment_terms}
                      wide
                    />
                  )}
                  {r.shipping_notes && <Field label="Envío" value={r.shipping_notes} wide />}
                </div>

                {r.message && (
                  <p className="mt-1.5 text-xs text-neutral-700 inline-flex items-start gap-1">
                    <MessageSquare className="w-3 h-3 mt-0.5 text-muted-foreground" />
                    {r.message}
                  </p>
                )}

                {isOpen && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => respond(r, "accept")}
                      className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1 disabled:opacity-60"
                    >
                      {busy === r.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Aceptar
                    </button>
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => respond(r, "reject")}
                      className="text-xs px-3 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-60"
                    >
                      <X className="w-3 h-3" /> Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(r);
                        setFormOpen(true);
                      }}
                      className="text-xs px-3 py-1 rounded border border-[hsl(var(--im-hairline,var(--border)))] hover:bg-neutral-50 inline-flex items-center gap-1"
                    >
                      <Reply className="w-3 h-3" /> Contra-ofertar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 md:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-xs font-mono">{value}</div>
    </div>
  );
}

function ProposeForm({
  tradeId,
  defaultParty,
  replyTo,
  busy,
  onCancel,
  onSubmit,
}: {
  tradeId: string;
  defaultParty: Party;
  replyTo: NegotiationRow | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (args: ProposeArgs) => void;
}) {
  const [party, setParty] = useState<Party>(
    replyTo
      ? replyTo.party === "buyer"
        ? "seller"
        : replyTo.party === "seller"
          ? "buyer"
          : defaultParty
      : defaultParty,
  );
  const [price, setPrice] = useState<string>(replyTo?.price_usd_t?.toString() ?? "");
  const [quantity, setQuantity] = useState<string>(replyTo?.quantity_t?.toString() ?? "");
  const [incoterm, setIncoterm] = useState<string>(replyTo?.incoterm ?? "CIF");
  const [portLoading, setPortLoading] = useState<string>(replyTo?.port_loading ?? "");
  const [portDischarge, setPortDischarge] = useState<string>(replyTo?.port_discharge ?? "");
  const [deliveryFrom, setDeliveryFrom] = useState<string>(replyTo?.delivery_from ?? "");
  const [deliveryTo, setDeliveryTo] = useState<string>(replyTo?.delivery_to ?? "");
  const [paymentTerms, setPaymentTerms] = useState<string>(
    replyTo?.payment_terms ?? "DLC irrevocable a la vista",
  );
  const [shippingNotes, setShippingNotes] = useState<string>(replyTo?.shipping_notes ?? "");
  const [validUntil, setValidUntil] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const num = (s: string): number | null => {
    const n = Number(s);
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };
  const s = (v: string): string | null => (v.trim() === "" ? null : v.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      p_trade_id: tradeId,
      p_party: party,
      p_price_usd_t: num(price),
      p_quantity_t: num(quantity),
      p_incoterm: s(incoterm),
      p_port_loading: s(portLoading),
      p_port_discharge: s(portDischarge),
      p_delivery_from: s(deliveryFrom),
      p_delivery_to: s(deliveryTo),
      p_payment_terms: s(paymentTerms),
      p_shipping_notes: s(shippingNotes),
      p_valid_until: s(validUntil),
      p_message: s(message),
      p_replies_to: replyTo?.id ?? null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-neutral-50/40 p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {replyTo ? (
          <>
            <Reply className="w-3 h-3" /> Contra-oferta a {PARTY_LABEL[replyTo.party]} ·{" "}
            {usd(replyTo.price_usd_t)}
          </>
        ) : (
          <>Nueva propuesta</>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Labelled label="Firma como">
          <select
            value={party}
            onChange={(e) => setParty(e.target.value as Party)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          >
            <option value="buyer">Comprador</option>
            <option value="seller">Vendedor</option>
            <option value="geocapitals">Geocapitals</option>
          </select>
        </Labelled>
        <Labelled label="Precio (US$/t)">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="9500"
          />
        </Labelled>
        <Labelled label="Cantidad (t)">
          <input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="1000"
          />
        </Labelled>
        <Labelled label="Incoterm">
          <select
            value={incoterm}
            onChange={(e) => setIncoterm(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          >
            {INCOTERMS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Puerto de carga">
          <input
            value={portLoading}
            onChange={(e) => setPortLoading(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="Antofagasta"
          />
        </Labelled>
        <Labelled label="Puerto de descarga">
          <input
            value={portDischarge}
            onChange={(e) => setPortDischarge(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="Shanghai"
          />
        </Labelled>
        <Labelled label="Entrega desde">
          <input
            type="date"
            value={deliveryFrom}
            onChange={(e) => setDeliveryFrom(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          />
        </Labelled>
        <Labelled label="Entrega hasta">
          <input
            type="date"
            value={deliveryTo}
            onChange={(e) => setDeliveryTo(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          />
        </Labelled>

        <Labelled label="Términos de pago" wide>
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="DLC irrevocable a la vista"
          />
        </Labelled>
        <Labelled label="Notas de envío" wide>
          <input
            value={shippingNotes}
            onChange={(e) => setShippingNotes(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder="Contenedores 20', 25 t/contenedor"
          />
        </Labelled>
        <Labelled label="Válida hasta">
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
          />
        </Labelled>
      </div>

      <Labelled label="Mensaje / justificación">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full text-xs border rounded px-2 py-1 bg-white"
          placeholder="Comentario para la contraparte…"
        />
      </Labelled>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded border border-[hsl(var(--im-hairline,var(--border)))] hover:bg-neutral-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          {replyTo ? "Enviar contra-oferta" : "Enviar oferta"}
        </button>
      </div>
    </form>
  );
}

function Labelled({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "col-span-2 md:col-span-2" : ""}`}>
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </span>
      {children}
    </label>
  );
}
