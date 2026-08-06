import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ship,
  FileText,
  Handshake,
  MessageSquare,
  Anchor,
  ExternalLink,
  PackageCheck,
  Banknote,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getTradeTracking } from "@/lib/tradeTracking.functions";
import {
  JOURNEY_STEPS,
  journeyStep,
  journeyHeadline,
  normalizeEvent,
  type TimelineItem,
} from "@/lib/tradeTimeline";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipments";
import {
  listTradePayments,
  createTradePayment,
  markTradePaymentPaid,
  cancelTradePayment,
  type PaymentRow,
} from "@/lib/payments.functions";
import {
  PAYMENT_KINDS,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  effectivePaymentStatus,
  type PaymentKind,
} from "@/lib/payments";
import { TradeCopilotPanel } from "@/features/trades/TradeCopilotPanel";
import { CommodityIntelPanel } from "@/features/trades/CommodityIntelPanel";
import { TradeComplianceChecklist } from "@/features/trades/TradeComplianceChecklist";
import { TradeScreeningPanel } from "@/features/trades/TradeScreeningPanel";
import { TradeMarginPanel } from "@/features/trades/TradeMarginPanel";
import { TradeNegotiationPanel } from "@/features/trades/TradeNegotiationPanel";
import { TradeParticipantsPanel } from "@/features/trades/TradeParticipantsPanel";
import { TradeKycPanel } from "@/features/trades/TradeKycPanel";
import { TradeDocsPanel } from "@/features/trades/TradeDocsPanel";
import { setTradeStage } from "@/lib/trades.functions";
import { useQueryClient } from "@tanstack/react-query";

// Trazabilidad unificada del trade — "Uber de los commodities": un titular de
// estado, el viaje en pasos y el timeline completo (acuerdo, documentos, pago,
// embarques) en una sola línea de tiempo.

export const Route = createFileRoute("/_authenticated/dashboard/trades_/$tradeId")({
  head: () => ({ meta: [{ title: "Trazabilidad de la operación — Geocapitals" }] }),
  component: TrackingPage,
});

const CATEGORY_ICON: Record<TimelineItem["category"], typeof Ship> = {
  trade: Handshake,
  document: FileText,
  shipment: Ship,
  payment: Banknote,
  message: MessageSquare,
};

const CATEGORY_COLOR: Record<TimelineItem["category"], string> = {
  trade: "text-primary",
  document: "text-signal-violet",
  shipment: "text-teal",
  payment: "text-green-600",
  message: "text-muted-foreground",
};

const usd0 = (n: number | null | undefined) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";

const STAGE_ORDER = ["icpo", "fco", "spa", "payment", "shipping", "delivered", "closed"] as const;
type Stage = (typeof STAGE_ORDER)[number];
const STAGE_LABEL: Record<Stage, string> = {
  icpo: "ICPO",
  fco: "Evaluación comercial (FCO)",
  spa: "Contrato (SPA)",
  payment: "Pago",
  shipping: "Embarque",
  delivered: "Entregado",
  closed: "Cerrado",
};

function TrackingPage() {
  const { tradeId } = Route.useParams();
  const fn = useServerFn(getTradeTracking);
  const advanceStage = useServerFn(setTradeStage);
  const qc = useQueryClient();
  const [readiness, setReadiness] = useState<{
    mandatory_total: number;
    mandatory_ok: number;
    mandatory_missing: number;
    optional_total: number;
    ready: boolean;
  } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["trade-tracking", tradeId],
    queryFn: () => fn({ data: { tradeId } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="h-40 rounded-md bg-muted/20 animate-pulse" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 max-w-3xl text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Operación no encontrada</h1>
        <p className="text-sm text-text-secondary mb-4">
          No existe o no eres contraparte de este trade.
        </p>
        <Link to="/dashboard/trades" className="text-primary underline text-sm">
          Volver al Trade Desk
        </Link>
      </div>
    );
  }

  const { trade, shipments, events, docsCount } = data;
  const activeShipment = shipments[0] ?? null;
  const step = journeyStep(trade.stage, activeShipment?.status ?? null);
  const headline = journeyHeadline(step, {
    vessel: activeShipment?.vessel_name,
    etaIso: activeShipment?.eta,
    arrived: activeShipment?.status === "arrived",
  });
  const items = events.map(normalizeEvent).reverse(); // más reciente primero

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <Link
        to="/dashboard/trades"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Trade Desk
      </Link>

      {/* Cabecera estilo tracking */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {trade.reference ?? trade.id.slice(0, 8)} · {trade.commodity ?? "commodity"}
          {trade.quantity_t ? ` · ${trade.quantity_t} t` : ""}
          {trade.incoterm ? ` · ${trade.incoterm}` : ""}
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">{headline}</h1>

        {/* Stepper del viaje */}
        <div className="mt-5 flex items-center">
          {JOURNEY_STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 ${
                    i < step
                      ? "bg-primary border-primary"
                      : i === step
                        ? "bg-primary/30 border-primary animate-pulse"
                        : "bg-transparent border-muted"
                  }`}
                />
                <span
                  className={`mt-1.5 text-[9px] font-mono uppercase tracking-wide ${
                    i <= step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < JOURNEY_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trade Copilot — resumen IA + backfill de términos */}
      <TradeCopilotPanel
        tradeId={trade.id}
        hasMissingTerms={
          trade.quantity_t == null ||
          trade.incoterm == null ||
          trade.unit_price_usd == null
        }
      />

      {/* Inteligencia de mercado */}
      {trade.commodity && (
        <CommodityIntelPanel commodity={trade.commodity} quantityT={trade.quantity_t ?? null} />
      )}



      {/* Carga activa */}
      {activeShipment && (
        <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <PackageCheck className="w-3.5 h-3.5 text-teal" /> Carga ·{" "}
            {SHIPMENT_STATUS_LABELS[activeShipment.status]}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {activeShipment.vessel_name && (
              <span className="inline-flex items-center gap-1">
                <Ship className="w-3 h-3" /> {activeShipment.vessel_name}
              </span>
            )}
            {activeShipment.bl_number && <span>BL {activeShipment.bl_number}</span>}
            {(activeShipment.port_loading || activeShipment.port_discharge) && (
              <span className="inline-flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                {activeShipment.port_loading ?? "—"} → {activeShipment.port_discharge ?? "—"}
              </span>
            )}
            {activeShipment.eta && (
              <span>ETA {new Date(activeShipment.eta).toLocaleDateString("es-CL")}</span>
            )}
            {activeShipment.tracking_url && (
              <a
                href={activeShipment.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Tracking naviera <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Documentos del acuerdo — generar, enviar a firma y trazar */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          <FileText className="w-3.5 h-3.5 text-signal-violet" /> Documentos del acuerdo ·{" "}
          {docsCount} archivo(s)
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Genera el documento con la contraparte precargada — al firmarse queda registrado en este
          timeline automáticamente.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["nda", "NDA"],
              ["data-sheet", "Data Sheet"],
              ["loi", "LOI"],
              ["spa", "Contrato SPA"],
            ] as const
          ).map(([tpl, label]) => (
            <Link
              key={tpl}
              to="/dashboard/documentos/$templateId"
              params={{ templateId: tpl }}
              search={{ trade: trade.id }}
              className="px-3 py-1.5 rounded border border-border text-xs hover:bg-accent inline-flex items-center gap-1.5"
            >
              <FileText className="w-3 h-3" /> {label}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Link
            to="/dashboard/proveedores"
            className="px-2.5 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
          >
            <Handshake className="w-3 h-3" /> Ver proveedores
          </Link>
          <Link
            to="/dashboard/rfqs"
            className="px-2.5 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
          >
            <FileText className="w-3 h-3" /> Requerimientos (RFQ)
          </Link>
        </div>
      </div>

      {/* Negociación estructurada de términos (oferta / contra-oferta) */}
      <TradeNegotiationPanel
        tradeId={trade.id}
        onAccepted={() => {
          void qc.invalidateQueries({ queryKey: ["trade-tracking", trade.id] });
        }}
      />

      {/* Checklist REICON: compliance de la operación */}
      <TradeComplianceChecklist tradeId={trade.id} onReadinessChange={setReadiness} />

      {/* Screening de sanciones (visible solo staff GC) */}
      <TradeScreeningPanel tradeId={trade.id} />

      {/* Margen y reparto de comisiones (visible solo staff GC) */}
      <TradeMarginPanel tradeId={trade.id} />

      {/* Participantes: brókers, asesores y contrapartes con enlace propio */}
      <TradeParticipantsPanel tradeId={trade.id} />

      {/* Expediente KYC / prueba de fondos por parte */}
      <TradeKycPanel tradeId={trade.id} />

      {/* Documentos comerciales bilingües (ICPO / FCO / IMFPA + ficha) */}
      <TradeDocsPanel
        input={{
          reference: trade.reference ?? null,
          commodity: trade.commodity ?? null,
          incoterm: trade.incoterm ?? null,
          quantity: trade.quantity_t != null ? `${trade.quantity_t} t` : null,
          price:
            trade.unit_price_usd != null
              ? `US$ ${Number(trade.unit_price_usd).toLocaleString("es-CL")} / t`
              : null,
        }}
      />

      {/* Gate de avance de etapa por readiness */}
      {(() => {
        const currentStage = (trade.stage ?? "icpo") as Stage;
        const idx = STAGE_ORDER.indexOf(currentStage);
        const next = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
        if (!next) return null;
        const ready = readiness?.ready === true;
        const missing = readiness?.mandatory_missing ?? null;
        const label =
          next === "fco" ? "Pasar a evaluación comercial" : `Avanzar a ${STAGE_LABEL[next]}`;
        const tip = ready
          ? "Todos los documentos obligatorios están conformes."
          : missing != null
            ? `Faltan ${missing} documento(s) obligatorio(s)`
            : "Cargando estado de compliance…";
        return (
          <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Etapa actual
              </div>
              <div className="font-medium text-sm">{STAGE_LABEL[currentStage]}</div>
              <div className="text-muted-foreground mt-1">{tip}</div>
            </div>
            <button
              disabled={!ready || advancing}
              title={tip}
              onClick={async () => {
                setAdvancing(true);
                try {
                  await advanceStage({ data: { id: trade.id, stage: next } });
                  toast.success(`Etapa actualizada a ${STAGE_LABEL[next]}`);
                  await qc.invalidateQueries({ queryKey: ["trade-tracking", trade.id] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo avanzar la etapa.");
                } finally {
                  setAdvancing(false);
                }
              }}
              className={`text-xs px-4 py-2 rounded border inline-flex items-center gap-2 ${
                ready
                  ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
                  : "border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed"
              }`}
            >
              {ready ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {label}
            </button>
          </div>
        );
      })()}



      {/* Finanzas del trade: cronograma de pagos */}
      <PaymentsSection tradeId={trade.id} />

      {/* Timeline unificado */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Historial de la operación · {items.length} evento(s)
        </h2>
        {items.length === 0 ? (
          <div className="rounded-md border border-border p-6 text-center text-sm text-text-secondary">
            Aún no hay eventos registrados en esta operación.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {items.map((it) => {
              const Icon = CATEGORY_ICON[it.category];
              return (
                <li key={it.id} className="ml-5">
                  <span
                    className={`absolute -left-[9px] mt-1 flex w-4 h-4 items-center justify-center rounded-full bg-background border border-border`}
                  >
                    <Icon className={`w-2.5 h-2.5 ${CATEGORY_COLOR[it.category]}`} />
                  </span>
                  <div className="text-sm font-medium">{it.title}</div>
                  {it.detail && (
                    <div className="text-xs text-text-secondary mt-0.5">{it.detail}</div>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {new Date(it.at).toLocaleString("es-CL")}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

const STATUS_CLS: Record<string, string> = {
  pagado: "bg-green-500/15 text-green-700",
  vencido: "bg-red-500/15 text-red-600",
  programado: "bg-amber-500/15 text-amber-700",
  cancelado: "bg-muted text-muted-foreground",
};

function PaymentsSection({ tradeId }: { tradeId: string }) {
  const listFn = useServerFn(listTradePayments);
  const createFn = useServerFn(createTradePayment);
  const paidFn = useServerFn(markTradePaymentPaid);
  const cancelFn = useServerFn(cancelTradePayment);

  const { data, refetch } = useQuery({
    queryKey: ["trade-payments", tradeId],
    queryFn: () => listFn({ data: { tradeId } }),
    staleTime: 30_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kind: "anticipo" as PaymentKind,
    label: "",
    amountUsd: "",
    instrument: "" as "" | "sblc_mt760" | "dlc" | "tt" | "escrow" | "otro",
    dueDate: "",
  });

  const onCreate = async () => {
    setSaving(true);
    try {
      await createFn({
        data: {
          tradeId,
          kind: form.kind,
          label: form.label || undefined,
          amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
          instrument: form.instrument || undefined,
          dueDate: form.dueDate || undefined,
        },
      });
      toast.success("Pago agregado al cronograma.");
      setForm({ kind: "anticipo", label: "", amountUsd: "", instrument: "", dueDate: "" });
      setShowForm(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo agregar.");
    } finally {
      setSaving(false);
    }
  };

  const onPaid = async (id: string) => {
    try {
      await paidFn({ data: { id } });
      toast.success("Pago marcado como recibido.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  };
  const onCancel = async (id: string) => {
    try {
      await cancelFn({ data: { id } });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cancelar.");
    }
  };

  const s = data?.summary;
  const now = new Date();

  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Banknote className="w-3.5 h-3.5 text-green-600" /> Finanzas · pagos
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Agregar pago
        </button>
      </div>

      {data?.pending && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          Los pagos se activan al aplicar la migración{" "}
          <code className="font-mono">20260719200000_trade_payments.sql</code>.
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          ["Comprometido", usd0(s?.scheduledUsd ?? 0), "text-foreground"],
          ["Cobrado", usd0(s?.paidUsd ?? 0), "text-green-600"],
          ["Por cobrar", usd0(s?.outstandingUsd ?? 0), "text-amber-600"],
          [
            "Vencido",
            usd0(s?.overdueUsd ?? 0),
            (s?.overdueUsd ?? 0) > 0 ? "text-red-600" : "text-foreground",
          ],
        ].map(([label, val, cls]) => (
          <div key={label} className="rounded border border-border p-2">
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className={`text-sm font-mono font-bold ${cls}`}>{val}</div>
          </div>
        ))}
      </div>
      {(s?.scheduledUsd ?? 0) > 0 && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-green-600" style={{ width: `${s?.progressPct ?? 0}%` }} />
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            {s?.progressPct ?? 0}% cobrado
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded border border-border bg-bg-primary/40 p-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">Tipo</span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as PaymentKind })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            >
              {PAYMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">Etiqueta</span>
            <input
              value={form.label}
              placeholder="30% anticipo"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">Monto US$</span>
            <input
              type="number"
              min={0}
              value={form.amountUsd}
              onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">Instrumento</span>
            <select
              value={form.instrument}
              onChange={(e) =>
                setForm({ ...form, instrument: e.target.value as typeof form.instrument })
              }
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            >
              <option value="">—</option>
              <option value="sblc_mt760">SBLC MT760</option>
              <option value="dlc">DLC</option>
              <option value="tt">TT</option>
              <option value="escrow">Escrow</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-text-secondary mb-1">Vence</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              onClick={() => void onCreate()}
              disabled={saving}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              {saving ? "Agregando…" : "Agregar pago"}
            </button>
          </div>
        </div>
      )}

      {(data?.payments.length ?? 0) === 0 ? (
        <div className="text-xs text-text-secondary py-3">
          Sin pagos en el cronograma. Agrega el anticipo, el pago contra embarque y el balance para
          seguir la cobranza de la operación.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Concepto</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Vence</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.payments ?? []).map((p: PaymentRow) => {
                const st = effectivePaymentStatus(p, now);
                return (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">
                        {p.label ?? PAYMENT_KIND_LABELS[p.kind as PaymentKind] ?? p.kind}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {PAYMENT_KIND_LABELS[p.kind as PaymentKind] ?? p.kind}
                        {p.instrument ? ` · ${p.instrument.toUpperCase()}` : ""}
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-mono">{usd0(p.amount_usd)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {p.due_date ? new Date(p.due_date).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_CLS[st]}`}
                      >
                        {PAYMENT_STATUS_LABELS[st]}
                      </span>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {st !== "pagado" && st !== "cancelado" && (
                        <>
                          <button
                            onClick={() => void onPaid(p.id)}
                            className="text-[11px] font-mono text-green-600 hover:underline inline-flex items-center gap-1 mr-3"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Pagado
                          </button>
                          <button
                            onClick={() => void onCancel(p.id)}
                            className="text-[11px] font-mono text-muted-foreground hover:underline"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
