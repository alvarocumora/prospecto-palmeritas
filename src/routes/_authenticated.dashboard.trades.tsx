import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  FileCheck,
  Plus,
  Loader2,
  Ship,
  PenLine,
  Check,
  ExternalLink,
  Info,
  ChevronRight,
  FileDown,
  Upload,
  ShieldCheck,
  MessageSquare,
  Send,
  FileSignature,
} from "lucide-react";
import { verifyCommodityLot } from "@/lib/lotVerification.functions";
import { QueryError } from "@/components/ui/QueryError";
import { buildTradeDoc, isGeneratable } from "@/lib/tradeDocGen";
import { renderTradeDocPdf } from "@/lib/tradeDocPdf";
import {
  listMyTrades,
  getTradeDetail,
  createTrade,
  setTradeStage,
  upsertTradeDocument,
  signTradeDocument,
  requestTradeDocUpload,
  getTradeDocDownloadUrl,
  listTradeEvents,
  addTradeMessage,
  requestTradeDocs,
} from "@/lib/trades.functions";
import { ensureCounterpartyLink, linkPartnerToTrade } from "@/lib/tradeOps.functions";
import { listPartners, upsertPartner } from "@/lib/clients.functions";
import { PARTNER_ROLES } from "@/lib/clients";
import { OPERATOR_LINE } from "@/lib/documents/company";
import { listMySignRequests } from "@/lib/documents/signing.functions";
import {
  sendSupplierOnboarding,
  sendSupplierOnboardingBatch,
  listOnboardingStatusForTrades,
  type OnboardingStatus,
} from "@/lib/supplierOnboarding.functions";
import { dispatchAntimonyPackage } from "@/lib/antimonyDispatch.functions";
import { dispatchCopperPackage } from "@/lib/copperDispatch.functions";
import { getEmailDeliveryStatus, type DeliveryRow } from "@/lib/email/deliveryStatus.functions";
import {
  DOC_CATALOG,
  DOC_BY_KEY,
  TRADE_STAGES,
  PHASE_LABEL,
  tradeProgress,
  stageIndex,
  type TradePhase,
  type TradeStage,
} from "@/lib/tradeDocuments";
import { TradePackPanel } from "@/features/trades/TradePackPanel";
import { useTradeDetailRealtime } from "@/features/trade-board/useTradeBoardRealtime";

export const Route = createFileRoute("/_authenticated/dashboard/trades")({
  head: () => ({ meta: [{ title: "Trade Desk — Geocapitals" }] }),
  component: TradesPage,
});

const fmtUsd = (n: number | null | undefined) =>
  n == null ? "—" : `US$ ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function TradesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="mx-auto w-full max-w-6xl bg-surface p-4 text-content md:p-6">
      <header className="mb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </Link>
        <h1 className="font-serif text-3xl font-normal mt-1 flex items-center gap-2">
          <Ship className="w-5 h-5 text-accent-brand" /> Trade Desk · comercio de commodities
        </h1>
        <p className="text-xs text-content-subtle mt-1">
          Transacciones de concentrado, cátodos y minerales con su ciclo completo: ICPO · FCO · SPA
          · pago (SBLC/DLC) · documentos de exportación y embarque.
        </p>
      </header>

      <div className="rounded border border-brand-warn/30 bg-brand-warn/5 px-3 py-2 text-[11px] text-brand-warn mb-4 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Gestión documental y de estado del deal entre contrapartes. No emite instrumentos
        financieros ni sustituye la revisión bancaria/legal de los documentos.
      </div>

      {selected ? (
        <TradeDetail id={selected} onBack={() => setSelected(null)} />
      ) : (
        <TradesList onOpen={setSelected} />
      )}
    </div>
  );
}

// ---------- Lista + crear ----------
function TradesList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTrades);
  const createFn = useServerFn(createTrade);
  const batchFn = useServerFn(sendSupplierOnboardingBatch);
  const statusFn = useServerFn(listOnboardingStatusForTrades);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-trades"],
    queryFn: () => listFn(),
  });
  const tradeIds = useMemo(() => (data ?? []).map((t) => t.id), [data]);
  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding-status", tradeIds],
    queryFn: () => statusFn({ data: { tradeIds } }),
    enabled: tradeIds.length > 0,
    staleTime: 30_000,
  });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    counterpartyEmail: "",
    counterpartyName: "",
    counterpartyCompany: "",
    counterpartyCountry: "",
    counterpartyPhone: "",
    side: "sell" as "buy" | "sell",
    commodity: "Cu",
    form: "concentrate",
    quantityT: "",
    incoterm: "CIF",
    unitPriceUsd: "",
    paymentInstrument: "sblc_mt760" as "sblc_mt760" | "dlc" | "tt" | "escrow",
    reference: "",
  });

  const submit = async () => {
    const hasEmail = form.counterpartyEmail.trim().length > 0;
    const hasExternal =
      form.counterpartyName.trim().length > 0 && form.counterpartyCompany.trim().length > 0;
    if (!hasEmail && !hasExternal)
      return toast.error("Indica email de contraparte o nombre + empresa.");
    setSaving(true);
    try {
      const { id } = await createFn({
        data: {
          counterpartyEmail: form.counterpartyEmail.trim() || undefined,
          counterpartyName: form.counterpartyName.trim() || undefined,
          counterpartyCompany: form.counterpartyCompany.trim() || undefined,
          counterpartyCountry: form.counterpartyCountry.trim() || undefined,
          counterpartyPhone: form.counterpartyPhone.trim() || undefined,
          side: form.side,
          reference: form.reference || undefined,
          commodity: form.commodity || undefined,
          form: form.form || undefined,
          quantityT: form.quantityT ? Number(form.quantityT) : undefined,
          incoterm: form.incoterm || undefined,
          unitPriceUsd: form.unitPriceUsd ? Number(form.unitPriceUsd) : undefined,
          paymentInstrument: form.paymentInstrument,
        },
      });
      toast.success("Trade creado.");
      setShowForm(false);
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
      onOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const startAntimony = async () => {
    setSaving(true);
    try {
      const ym = new Date().toISOString().slice(0, 7).replace("-", "");
      const seq = String(Math.floor(Math.random() * 9000) + 1000);
      const { id } = await createFn({
        data: {
          side: "sell",
          reference: `SB-ANTIMONIO-${ym}-${seq}`,
          commodity: "Antimony (Sb)",
          form: "Refined Antimony Metal Ingots · min 99.65% Sb · Standard Commercial Grade",
          quantityT: 1500,
          incoterm: "CIF",
          paymentInstrument: "mt103",
          counterpartyName: "Vincent Carpio",
          counterpartyCompany: "Carpio & Kaddu Group",
          counterpartyCountry: "US",
          counterpartyEmail: "vincent@carpiokaddu.com",
          notes:
            "Operación única Antimonio · 1,500 MT/mes × 12 meses · CIF Florida, USA · Pago SWIFT MT103.\n" +
            "Seller: Aupal Propiedades — Ana Rojo (ana.rojo67@gmail.com). Buyer: Carpio & Kaddu Group — Vincent Carpio + Marcela A. Cimino.\n" +
            "Pureza mín. 99.65% Sb (CoA muestra 99.75–99.90%). Origen: Seller's Option. Inspección: SGS / CCIC / Alex Stewart. Trial opcional por mutuo acuerdo. NCNDA firmado por las 3 partes.",
        },
      });
      toast.success(
        "Operación de Antimonio creada (1,500 MT/mes · MT103). Emite el link a las contrapartes.",
      );
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
      onOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la operación.");
    } finally {
      setSaving(false);
    }
  };

  const startCopper = async () => {
    setSaving(true);
    try {
      const ym = new Date().toISOString().slice(0, 7).replace("-", "");
      const seq = String(Math.floor(Math.random() * 9000) + 1000);
      const { id } = await createFn({
        data: {
          side: "sell",
          reference: `CU-CATHODE-${ym}-${seq}`,
          commodity: "Copper Cathode Grade A (Cu)",
          form: "Cathode plates · ASTM B115 / B49 · 99.97–99.99% Cu",
          quantityT: 2000,
          incoterm: "CIF",
          paymentInstrument: "dlc_mt700",
          notes:
            "Copper Cathode Grade A · Trial 500 MT · Contract 2,000 MT/mes · 12 meses + extensiones. " +
            "CIF puerto designado por Buyer · Loading port Seller's option · Embarque 15–20 días bancarios tras verificación del instrumento. " +
            "Payment: Opción A DLC MT700 irrevocable, transferible, confirmado, at sight, UCP 600 (Top 50 Bank) · Opción B SBLC MT760 (Top 50 Bank). " +
            "Performance Bond 2% emitido por Seller dentro de 10 días bancarios tras verificación del instrumento. " +
            "POP en 5 días bancarios: Commercial Invoice, Packing List, Certificate of Origin, SGS QC, Warehouse Receipt, Export Authorization (si aplica), fotos, Draft B/L. " +
            "Shipping docs: Full set Clean On Board B/L, SGS Inspection, Weight & Quality Cert, Insurance 110% CIF, fotos de carga, export customs. " +
            "Inspección SGS / CCIC / Alex Stewart o equivalente; destino a cargo del Buyer. " +
            "Procedimiento: ICPO/LOI+CIS → FCO+Seller CIS → SPA → PI → DLC/SBLC → PB 2% + POP → embarque 15–20 días → docs → destino → pago MT103 contra docs o según DLC.",
        },
      });
      toast.success("Trade de Cobre creado con términos CIF · DLC MT700 · 2.000 MT/mes.");
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
      onOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el trade de cobre.");
    } finally {
      setSaving(false);
    }
  };

  const dispatchFn = useServerFn(dispatchAntimonyPackage);
  const dispatchCopperFn = useServerFn(dispatchCopperPackage);
  const deliveryFn = useServerFn(getEmailDeliveryStatus);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchingCopper, setDispatchingCopper] = useState(false);

  const antimonyRecipients = useMemo(
    () => ["ana.rojo67@gmail.com", "ciminomarcela@gmail.com", "carpio@carpiokaddu.com"],
    [],
  );
  const antimonyTemplates = useMemo(() => ["supplier-onboarding", "antimony-product-sheet"], []);

  const {
    data: deliveryStatus,
    refetch: refetchDelivery,
    isFetching: fetchingDelivery,
  } = useQuery({
    queryKey: ["antimony-delivery-status"],
    queryFn: async (): Promise<DeliveryRow[]> =>
      (await deliveryFn({
        data: {
          recipients: antimonyRecipients,
          templateNames: antimonyTemplates,
          sinceHours: 72,
        },
      })) as DeliveryRow[],
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const dispatchAntimony = async () => {
    setDispatching(true);
    try {
      const res = await dispatchFn({ data: {} });
      const okCount = res.results.filter((r) => r.ok).length;
      const failCount = res.results.length - okCount;
      const detail = res.results
        .map((r) => `${r.kind} → ${r.to}: ${r.ok ? "ok" : (r.reason ?? "error")}`)
        .join("\n");
      if (failCount === 0)
        toast.success(`Paquete Antimonio enviado (${okCount})`, { description: detail });
      else toast.warning(`Enviados ${okCount} · fallidos ${failCount}`, { description: detail });
      // Refresca el panel de estado tras el envío.
      setTimeout(() => void refetchDelivery(), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo despachar el paquete.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-accent-brand/40 bg-gradient-to-r from-gold/10 to-transparent p-3 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand">
              Quickstart · Antimonio
            </div>
            <div className="text-xs text-content mt-0.5">
              Iniciar la operación de <b>Sb Grade 2#</b> con el NCNDA firmado (Carpio & Kaddu ·
              Marcela A. Cimino · Alvaro Oliva). Precarga commodity, incoterm CIF y SBLC MT760.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void dispatchAntimony()}
              disabled={dispatching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-cobalt/60 bg-cobalt/10 text-cobalt text-xs font-semibold hover:bg-cobalt/20 disabled:opacity-50 shrink-0"
              title="Envía NDA+LOI+Portal a Ana Rojo y ficha técnica del antimonio a Marcela y Vincent"
            >
              {dispatching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Enviar LOI a Ana + Fichas a Carpio & Kaddu
            </button>
            <button
              onClick={() => void startAntimony()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-brand text-black text-xs font-semibold hover:bg-accent-brand/90 disabled:opacity-50 shrink-0"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ship className="w-3.5 h-3.5" />
              )}
              Iniciar operación Antimonio
            </button>
            <button
              onClick={() => void startCopper()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-cobalt/60 bg-cobalt text-accent-brand-contrast text-xs font-semibold hover:bg-cobalt/90 disabled:opacity-50 shrink-0"
              title="Copper Cathode Grade A · CIF · DLC MT700 · 2.000 MT/mes · 12 meses"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ship className="w-3.5 h-3.5" />
              )}
              Iniciar operación Cobre (Cu Cathode)
            </button>
            <button
              onClick={async () => {
                setDispatchingCopper(true);
                try {
                  const res = await dispatchCopperFn({ data: {} });
                  const okCount = res.results.filter((r) => r.ok).length;
                  const failCount = res.results.length - okCount;
                  const detail = res.results
                    .map((r) => `${r.to}: ${r.ok ? "ok" : (r.reason ?? "error")}`)
                    .join("\n");
                  if (res.results.length === 0) {
                    toast.warning(
                      "No hay trade de cobre o falta contraparte. Crea el trade y agrega email de contraparte.",
                    );
                  } else if (failCount === 0) {
                    toast.success(`Purchase Terms Cobre enviado (${okCount})`, {
                      description: detail,
                    });
                  } else {
                    toast.warning(`Enviados ${okCount} · fallidos ${failCount}`, {
                      description: detail,
                    });
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo despachar Cobre.");
                } finally {
                  setDispatchingCopper(false);
                }
              }}
              disabled={dispatchingCopper}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-cobalt/60 bg-cobalt/10 text-cobalt text-xs font-semibold hover:bg-cobalt/20 disabled:opacity-50 shrink-0"
              title="Genera y envía el PDF Purchase Terms Copper Cathode Grade A a la contraparte del trade"
            >
              {dispatchingCopper ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Enviar Purchase Terms Cobre (PDF)
            </button>
          </div>
        </div>
        <AntimonyDeliveryPanel
          rows={deliveryStatus ?? []}
          loading={fetchingDelivery}
          onRefresh={() => void refetchDelivery()}
        />
      </div>

      {(() => {
        const allIds = tradeIds;
        const allChecked = allIds.length > 0 && allIds.every((id) => checked.has(id));
        const someChecked = checked.size > 0;
        const runBatch = async () => {
          const ids = Array.from(checked);
          if (ids.length === 0) return;
          setBatching(true);
          try {
            const res = await batchFn({ data: { tradeIds: ids } });
            const { summary } = res;
            const parts = [
              `${summary.sent} enviados`,
              summary.created ? `${summary.created} creados sin email` : "",
              summary.failed ? `${summary.failed} con error` : "",
            ].filter(Boolean);
            if (summary.failed > 0) {
              const firstErr = res.results.find((r) => !r.ok);
              toast.warning(`Onboarding: ${parts.join(" · ")}`, {
                description: firstErr?.error ?? undefined,
              });
            } else {
              toast.success(`Onboarding enviado — ${parts.join(" · ")}`);
            }
            setChecked(new Set());
            void qc.invalidateQueries({ queryKey: ["my-trades"] });
            void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo enviar el lote");
          } finally {
            setBatching(false);
          }
        };
        return (
          <div className="rounded-lg border border-hairline bg-surface-2/30 p-2.5 mb-3 flex items-center justify-between gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-[11px] font-mono text-content-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => setChecked(e.target.checked ? new Set(allIds) : new Set())}
                className="accent-primary"
              />
              {someChecked ? `${checked.size} seleccionados` : "Seleccionar todos"}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void runBatch()}
                disabled={!someChecked || batching}
                title="Envía NDA + LOI + link del Portal a la contraparte de cada trade seleccionado"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-brand text-accent-brand-contrast text-xs font-medium hover:bg-accent-brand/90 disabled:opacity-40"
              >
                {batching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Enviar onboarding a {someChecked ? checked.size : "N"} trades
              </button>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-brand text-accent-brand-contrast text-xs font-medium hover:bg-accent-brand/90"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo trade
              </button>
            </div>
          </div>
        );
      })()}

      {showForm && (
        <div className="rounded-lg border border-hairline bg-surface-2/30 p-4 mb-4 grid sm:grid-cols-2 gap-2">
          <div className="sm:col-span-2 text-[10px] font-mono uppercase tracking-wider text-content-subtle -mb-1">
            Contraparte · usuario Geocapitals o externo
          </div>
          <F label="Email contraparte">
            <input
              value={form.counterpartyEmail}
              onChange={(e) => setForm({ ...form, counterpartyEmail: e.target.value })}
              placeholder="comprador@empresa.com"
              className={inputCls}
            />
          </F>
          <F label="Nombre (si no tiene cuenta)">
            <input
              value={form.counterpartyName}
              onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
              placeholder="Nombre y apellido"
              className={inputCls}
            />
          </F>
          <F label="Empresa">
            <input
              value={form.counterpartyCompany}
              onChange={(e) => setForm({ ...form, counterpartyCompany: e.target.value })}
              placeholder="Razón social"
              className={inputCls}
            />
          </F>
          <F label="País (ISO)">
            <input
              value={form.counterpartyCountry}
              onChange={(e) => setForm({ ...form, counterpartyCountry: e.target.value })}
              placeholder="CL, AE, CN…"
              className={inputCls}
            />
          </F>
          <F label="Teléfono">
            <input
              value={form.counterpartyPhone}
              onChange={(e) => setForm({ ...form, counterpartyPhone: e.target.value })}
              placeholder="+56 9 …"
              className={inputCls}
            />
          </F>

          <F label="Soy">
            <select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value as "buy" | "sell" })}
              className={inputCls}
            >
              <option value="sell">Vendedor</option>
              <option value="buy">Comprador</option>
            </select>
          </F>
          <F label="Folio (opcional)">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="TRD-2026-001"
              className={inputCls}
            />
          </F>
          <F label="Commodity">
            <input
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Forma">
            <select
              value={form.form}
              onChange={(e) => setForm({ ...form, form: e.target.value })}
              className={inputCls}
            >
              <option value="concentrate">Concentrado</option>
              <option value="cathode">Cátodos</option>
              <option value="ore">Mineral</option>
              <option value="dore">Doré</option>
            </select>
          </F>
          <F label="Cantidad (t)">
            <input
              type="number"
              value={form.quantityT}
              onChange={(e) => setForm({ ...form, quantityT: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Incoterm">
            <select
              value={form.incoterm}
              onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
              className={inputCls}
            >
              {["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"].map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </F>
          <F label="Precio USD/t">
            <input
              type="number"
              value={form.unitPriceUsd}
              onChange={(e) => setForm({ ...form, unitPriceUsd: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Instrumento de pago">
            <select
              value={form.paymentInstrument}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentInstrument: e.target.value as typeof form.paymentInstrument,
                })
              }
              className={inputCls}
            >
              <option value="mt103">SWIFT MT103 (Wire)</option>
              <option value="dlc_mt700">DLC MT700</option>
              <option value="sblc_mt760">SBLC MT760</option>
              <option value="tt">TT</option>
              <option value="escrow">Escrow</option>
            </select>
          </F>
          <div className="sm:col-span-2">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-brand text-accent-brand-contrast text-xs font-medium hover:bg-accent-brand/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}{" "}
              Crear trade
            </button>
          </div>
        </div>
      )}

      {isError ? (
        <QueryError message="No pudimos cargar tus trades." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <Empty>Sin trades todavía. Crea el primero para gestionar su ciclo documental.</Empty>
      ) : (
        (() => {
          const q = query.trim().toLowerCase();
          const filtered = (data ?? []).filter((t) => {
            if (!showCancelled && (t.status === "cancelled" || t.stage === "cancelled"))
              return false;
            if (!q) return true;
            return (
              (t.reference ?? "").toLowerCase().includes(q) ||
              (t.commodity ?? "").toLowerCase().includes(q) ||
              (t.form ?? "").toLowerCase().includes(q)
            );
          });
          const cancelledCount = (data ?? []).filter(
            (t) => t.status === "cancelled" || t.stage === "cancelled",
          ).length;
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-mono text-content-subtle pb-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar por ref, commodity…"
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-hairline bg-transparent text-xs"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={showCancelled}
                    onChange={(e) => setShowCancelled(e.target.checked)}
                    className="accent-accent-brand"
                  />
                  Ver cancelados{cancelledCount ? ` (${cancelledCount})` : ""}
                </label>
                <span className="shrink-0">
                  {filtered.length}/{(data ?? []).length}
                </span>
              </div>
              {filtered.map((t) => {
                const prog = tradeProgress(t.docs);
                const status = onboardingStatus?.status?.[t.id];
                const isChecked = checked.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`w-full rounded-lg border p-3 transition-colors ${
                      isChecked
                        ? "border-accent-brand bg-accent-brand/5"
                        : "border-hairline bg-surface-2/30 hover:border-accent-brand/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center pr-1 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(t.id);
                              else next.delete(t.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-accent-brand"
                        />
                      </label>
                      <button onClick={() => onOpen(t.id)} className="flex-1 min-w-0 text-left">
                        <div className="font-semibold text-sm truncate">
                          {t.reference ?? `${t.commodity ?? "Trade"} · ${t.form ?? ""}`}
                          <span className="ml-2 text-[10px] font-mono uppercase text-content-subtle">
                            {t.role === "buyer" ? "compra" : "venta"}
                          </span>
                        </div>
                        <div className="text-[11px] text-content-subtle font-mono">
                          {t.quantity_t ? `${t.quantity_t} t` : "—"} · {t.incoterm ?? "—"} ·{" "}
                          {fmtUsd(t.total_value_usd)} · {t.payment_instrument ?? "—"}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <OnboardingBadge s={status} />
                        <StagePill stage={t.stage} />
                        <div className="w-16 text-right">
                          <div className="text-xs font-mono font-semibold">{prog.overall.pct}%</div>
                          <div className="h-1 rounded bg-muted/40 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-accent-brand"
                              style={{ width: `${prog.overall.pct}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-content-subtle" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </>
  );
}

// ---------- Detalle: pipeline + checklist ----------
function TradeDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(getTradeDetail);
  const stageFn = useServerFn(setTradeStage);
  const { data, isLoading } = useQuery({
    queryKey: ["trade", id],
    queryFn: () => detailFn({ data: { id } }),
  });
  useTradeDetailRealtime(id);

  const progress = useMemo(
    () =>
      tradeProgress(
        (data?.documents ?? []).map((d) => ({ doc_type: d.doc_type, status: d.status })),
      ),
    [data],
  );

  const advance = async (stage: TradeStage) => {
    try {
      await stageFn({ data: { id, stage } });
      void qc.invalidateQueries({ queryKey: ["trade", id] });
      void qc.invalidateQueries({ queryKey: ["my-trades"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (isLoading) return <Loading />;
  if (!data) return <Empty>Trade no encontrado.</Empty>;
  const t = data.trade;
  const docsByType = new Map(data.documents.map((d) => [d.doc_type, d]));

  return (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[11px] font-mono text-content-subtle hover:text-content mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Trades
      </button>

      {/* Cabecera */}
      <div className="rounded-lg border border-hairline bg-surface-2/30 p-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold">{t.reference ?? "Trade"}</div>
            <div className="text-xs text-content-subtle font-mono mt-0.5">
              {t.commodity ?? "—"} · {t.form ?? "—"} · {t.quantity_t ?? "—"} t · {t.incoterm ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono">{fmtUsd(t.total_value_usd)}</div>
            <div className="text-[10px] text-content-subtle font-mono">
              {fmtUsd(t.unit_price_usd)}/t · {t.payment_instrument ?? "—"} ·{" "}
              {t.role === "buyer" ? "compra" : "venta"}
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-hairline/60 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent-brand">
          <ShieldCheck className="w-3 h-3" /> {OPERATOR_LINE}
        </div>
      </div>

      {/* Due diligence del lote de origen (Know-Your-Mine) */}
      {t.lot_id && <LotTrustCard lotId={t.lot_id} />}

      {/* Contraparte externa + link operación + solicitar documentos */}
      <SupplierPanel
        tradeId={id}
        currentName={t.role === "buyer" ? (t.sellerName ?? null) : (t.buyerName ?? null)}
        onLinked={() => void qc.invalidateQueries({ queryKey: ["trade", id] })}
      />
      <CounterpartyPanel trade={t} />
      <TradePackPanel tradeId={id} trade={t} />

      <SendDocPanel tradeId={id} />
      <RequestDocsPanel tradeId={id} docs={data.documents} />
      <UploadInboxPanel
        tradeId={id}
        docs={data.documents}
        onChange={() => void qc.invalidateQueries({ queryKey: ["trade", id] })}
      />

      {/* Pipeline */}
      <div className="rounded-lg border border-hairline p-4 mb-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TRADE_STAGES.map((s, i) => {
            const active = stageIndex(t.stage) >= i;
            const current = t.stage === s.key;
            return (
              <button
                key={s.key}
                onClick={() => void advance(s.key)}
                title={s.label}
                className={`flex items-center gap-1.5 ${i > 0 ? "ml-1" : ""}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono border ${
                    current
                      ? "bg-accent-brand text-accent-brand-contrast border-accent-brand"
                      : active
                        ? "bg-accent-brand/15 text-accent-brand border-accent-brand/40"
                        : "bg-muted/30 text-content-subtle border-hairline"
                  }`}
                >
                  {active ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span
                  className={`text-[10px] font-mono whitespace-nowrap ${current ? "text-content font-semibold" : "text-content-subtle"}`}
                >
                  {s.label}
                </span>
                {i < TRADE_STAGES.length - 1 && (
                  <span className="w-4 h-px bg-border mx-1 hidden sm:inline-block" />
                )}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-content-subtle mt-2">
          Toca una etapa para avanzar el deal. Avance documental: {progress.overall.done}/
          {progress.overall.total} · núcleo {progress.coreDone}/{progress.coreTotal}.
        </div>
      </div>

      {/* Checklist documental por fase */}
      {(["comercial", "financiero", "exportacion"] as TradePhase[]).map((phase) => {
        const pp = progress.phases.find((x) => x.phase === phase)!;
        return (
          <div key={phase} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" /> {PHASE_LABEL[phase]}
              </div>
              <div className="text-[10px] font-mono text-content-subtle">
                {pp.done}/{pp.total}
              </div>
            </div>
            <div className="rounded-lg border border-hairline divide-y divide-border">
              {DOC_CATALOG.filter((d) => d.phase === phase).map((doc) => (
                <DocRow
                  key={doc.key}
                  tradeId={id}
                  trade={t}
                  doc={doc}
                  existing={docsByType.get(doc.key)}
                  onChange={() => void qc.invalidateQueries({ queryKey: ["trade", id] })}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Actividad y mensajería entre contrapartes */}
      <TradeActivity tradeId={id} />
    </>
  );
}

function TradeActivity({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTradeEvents);
  const msgFn = useServerFn(addTradeMessage);
  const { data } = useQuery({
    queryKey: ["trade-events", tradeId],
    queryFn: () => listFn({ data: { tradeId } }),
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setBusy(true);
    try {
      await msgFn({ data: { tradeId, message: msg.trim() } });
      setMsg("");
      void qc.invalidateQueries({ queryKey: ["trade-events", tradeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-2 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Actividad y mensajes
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Escribe un mensaje a la contraparte…"
          className="flex-1 px-3 py-2 text-xs bg-surface border border-hairline rounded focus:outline-none focus:border-accent-brand"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !msg.trim()}
          className="px-3 py-2 rounded bg-accent-brand text-accent-brand-contrast text-xs font-medium hover:bg-accent-brand/90 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" /> Enviar
        </button>
      </div>
      {(data ?? []).length === 0 ? (
        <div className="text-[11px] text-content-subtle">Sin actividad todavía.</div>
      ) : (
        <ol className="space-y-2 border-l border-hairline pl-3">
          {(data ?? []).map((e) => (
            <li key={e.id} className="relative text-xs">
              <span className="absolute -left-[15px] top-1.5 w-1.5 h-1.5 rounded-full bg-accent-brand/60" />
              <div>
                {e.kind === "message" ? (
                  <span className="text-content">{e.detail}</span>
                ) : (
                  <span className="text-content-subtle">{eventLabel(e)}</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-content-subtle/70">
                {e.actorName ?? "—"} · {new Date(e.created_at).toLocaleString("es-CL")}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function eventLabel(e: { kind: string; detail: string | null; doc_type: string | null }): string {
  const docLabel = e.doc_type
    ? (DOC_BY_KEY[e.doc_type]?.acronym ?? DOC_BY_KEY[e.doc_type]?.label ?? e.doc_type)
    : "";
  switch (e.kind) {
    case "created":
      return e.detail ?? "Trade creado";
    case "stage_changed": {
      const stage = TRADE_STAGES.find((s) => s.key === e.detail);
      return `Avanzó a: ${stage?.label ?? e.detail}`;
    }
    case "doc_uploaded":
      return `Cargó ${docLabel}`;
    case "doc_signed":
      return `Firmó ${docLabel}`;
    case "doc_verified":
      return `Verificó ${docLabel}`;
    default:
      return e.detail ?? e.kind;
  }
}

function DocRow({
  tradeId,
  trade,
  doc,
  existing,
  onChange,
}: {
  tradeId: string;
  trade: NonNullable<Awaited<ReturnType<typeof getTradeDetail>>>["trade"];
  doc: (typeof DOC_CATALOG)[number];
  existing?: {
    id: string;
    status: string;
    file_url: string | null;
    reference: string | null;
    issuer: string | null;
  };
  onChange: () => void;
}) {
  const upsertFn = useServerFn(upsertTradeDocument);
  const signFn = useServerFn(signTradeDocument);
  const uploadFn = useServerFn(requestTradeDocUpload);
  const downloadFn = useServerFn(getTradeDocDownloadUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(existing?.file_url ?? "");
  const [ref, setRef] = useState(existing?.reference ?? "");
  const [busy, setBusy] = useState(false);

  const onPickFile = async (file: File) => {
    setBusy(true);
    try {
      const { path, token, bucket } = await uploadFn({
        data: { tradeId, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (up.error) throw up.error;
      await upsertFn({ data: { tradeId, docType: doc.key, fileUrl: path, status: "uploaded" } });
      toast.success("Archivo subido");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async () => {
    if (!existing) return;
    try {
      const { url: signed } = await downloadFn({ data: { docId: existing.id } });
      if (signed) window.open(signed, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir");
    }
  };

  const generate = async () => {
    const model = buildTradeDoc(doc.key, {
      reference: trade.reference,
      commodity: trade.commodity,
      form: trade.form,
      quantity_t: trade.quantity_t,
      incoterm: trade.incoterm,
      unit_price_usd: trade.unit_price_usd,
      total_value_usd: trade.total_value_usd,
      currency: trade.currency,
      payment_instrument: trade.payment_instrument,
      buyerName: trade.buyerName,
      sellerName: trade.sellerName,
      date: new Date().toISOString(),
    });
    if (!model) return;
    try {
      await renderTradeDocPdf(model);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    }
  };

  const save = async (status?: string) => {
    setBusy(true);
    try {
      await upsertFn({
        data: {
          tradeId,
          docType: doc.key,
          fileUrl: url.trim() || undefined,
          reference: ref.trim() || undefined,
          status: status as never,
        },
      });
      toast.success("Documento actualizado");
      setOpen(false);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!existing) return;
    try {
      await signFn({ data: { docId: existing.id } });
      toast.success("Documento firmado");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const status = existing?.status ?? "pending";
  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">
            {doc.acronym && <span className="font-mono text-accent-brand mr-1">{doc.acronym}</span>}
            {doc.label}
            {doc.core && <span className="ml-1 text-[9px] text-accent-brand">•núcleo</span>}
          </div>
          <div className="text-[10px] text-content-subtle font-mono">
            {existing?.reference ? `N° ${existing.reference} · ` : ""}
            {doc.party === "buyer"
              ? "comprador"
              : doc.party === "seller"
                ? "vendedor"
                : doc.party === "both"
                  ? "ambas partes"
                  : "tercero"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
              e.target.value = "";
            }}
          />
          {existing?.file_url && (
            <button
              onClick={() => void openDoc()}
              className="p-1 text-accent-brand hover:underline"
              title="Ver documento"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {status !== "signed" && status !== "verified" && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="Subir archivo"
              className="px-2 py-1 rounded text-[10px] font-mono border border-hairline text-content-subtle hover:text-content disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            </button>
          )}
          <DocStatusPill status={status} />
          {isGeneratable(doc.key) && (
            <button
              onClick={() => void generate()}
              title="Generar borrador PDF"
              className="px-2 py-1 rounded text-[10px] font-mono border border-accent-brand/50 text-accent-brand hover:bg-accent-brand/10 inline-flex items-center gap-1"
            >
              <FileDown className="w-3 h-3" /> Generar
            </button>
          )}
          {status !== "signed" && status !== "verified" && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="px-2 py-1 rounded text-[10px] font-mono border border-hairline text-content-subtle hover:text-content"
            >
              {existing ? "Editar" : "Adjuntar"}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL del documento (https://…)"
            className="flex-1 min-w-[160px] px-2 py-1 text-[11px] bg-surface border border-hairline rounded focus:outline-none focus:border-accent-brand"
          />
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="N° doc"
            className="w-24 px-2 py-1 text-[11px] bg-surface border border-hairline rounded focus:outline-none focus:border-accent-brand"
          />
          <button
            onClick={() => void save("uploaded")}
            disabled={busy}
            className="px-2 py-1 rounded text-[10px] font-mono bg-accent-brand text-accent-brand-contrast disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={() => void save("verified")}
            disabled={busy}
            className="px-2 py-1 rounded text-[10px] font-mono border border-brand-success/50 text-brand-success"
          >
            <Check className="w-3 h-3 inline" /> Verificar
          </button>
          {existing && (
            <button
              onClick={() => void sign()}
              className="px-2 py-1 rounded text-[10px] font-mono border border-hairline text-content-subtle hover:text-content inline-flex items-center gap-1"
            >
              <PenLine className="w-3 h-3" /> Firmar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- UI helpers ----------
const inputCls =
  "w-full px-2 py-1.5 text-xs bg-surface border border-hairline rounded focus:outline-none focus:border-accent-brand";

function F({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-xs ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function StagePill({ stage }: { stage: string }) {
  const s = TRADE_STAGES.find((x) => x.key === stage);
  const closed = stage === "closed";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono border whitespace-nowrap ${
        closed
          ? "text-brand-success border-brand-success/40 bg-brand-success/10"
          : "text-accent-brand border-accent-brand/40 bg-accent-brand/10"
      }`}
    >
      {s?.label.split(" (")[0] ?? stage}
    </span>
  );
}

function DocStatusPill({ status }: { status: string }) {
  const tone =
    status === "verified"
      ? "text-brand-success border-brand-success/40 bg-brand-success/10"
      : status === "signed"
        ? "text-brand-info border-brand-info/40 bg-brand-info/10"
        : status === "uploaded"
          ? "text-brand-warn border-brand-warn/40 bg-brand-warn/10"
          : status === "rejected"
            ? "text-brand-danger border-brand-danger/40 bg-brand-danger/10"
            : "text-content-subtle border-hairline";
  const label: Record<string, string> = {
    pending: "Pendiente",
    uploaded: "Cargado",
    signed: "Firmado",
    verified: "Verificado",
    rejected: "Rechazado",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${tone}`}>
      {label[status] ?? status}
    </span>
  );
}

function LotTrustCard({ lotId }: { lotId: string }) {
  const fn = useServerFn(verifyCommodityLot);
  const { data } = useQuery({
    queryKey: ["lot-verification", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });
  const tone =
    data?.level === "high"
      ? "border-brand-success/40 bg-brand-success/5 text-brand-success"
      : data?.level === "medium"
        ? "border-brand-warn/40 bg-brand-warn/5 text-brand-warn"
        : "border-brand-danger/40 bg-brand-danger/5 text-brand-danger";
  return (
    <div className="rounded-lg border border-hairline bg-surface-2/30 p-3 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
          <ShieldCheck className="w-3.5 h-3.5" /> Due diligence del lote · Know-Your-Mine
        </div>
        <Link
          to="/marketplace/$lotId"
          params={{ lotId }}
          className="text-[11px] font-mono text-accent-brand hover:underline inline-flex items-center gap-1"
        >
          Ver lote <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      {data ? (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className={`px-2 py-1 rounded border text-sm font-bold ${tone}`}>
            {data.score}/100
          </span>
          <span className="text-xs font-medium">{data.levelLabel}</span>
          {data.redFlags.length > 0 && (
            <span className="text-[11px] text-brand-danger font-medium">
              {data.redFlags.length} bandera(s) roja(s)
            </span>
          )}
          {data.dictamen && (
            <p className="text-[11px] text-content-subtle w-full mt-1 leading-relaxed">
              {data.dictamen}
            </p>
          )}
        </div>
      ) : (
        <div className="h-8 mt-2 rounded bg-muted/20 animate-pulse" />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-content-subtle p-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 text-center text-sm text-content-subtle border border-dashed border-hairline rounded-lg">
      {children}
    </div>
  );
}

/* -------------------- Contraparte externa (link espejo) ------------------ */
function CounterpartyPanel({
  trade,
}: {
  trade: NonNullable<Awaited<ReturnType<typeof getTradeDetail>>>["trade"];
}) {
  const ensureFn = useServerFn(ensureCounterpartyLink);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const party: "buyer" | "seller" = trade.role === "buyer" ? "seller" : "buyer";
  const cpName =
    party === "buyer"
      ? (trade.buyerName ?? trade.buyerEmail ?? "Comprador")
      : (trade.sellerName ?? trade.sellerEmail ?? "Vendedor");
  const cpEmail = party === "buyer" ? trade.buyerEmail : trade.sellerEmail;

  const issue = async (rotate: boolean) => {
    setLoading(true);
    try {
      const r = await ensureFn({
        data: { tradeId: trade.id, party, email: cpEmail ?? undefined, rotate },
      });
      if (r.url) {
        setIssuedUrl(r.url);
        void navigator.clipboard.writeText(r.url).catch(() => {});
        toast.success("Link generado y copiado.");
      } else {
        toast.info(
          `Ya existe un link activo (prefijo ${r.prefix || "—"}). Usa "Rotar" para emitir uno nuevo.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-2/20 p-4 mb-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-2">
        Contraparte · {party === "buyer" ? "Comprador" : "Vendedor"}
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 text-xs">
          <div className="font-semibold text-content truncate">{cpName}</div>
          <div className="text-content-subtle font-mono text-[11px] truncate">
            {cpEmail ?? "sin email"}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void issue(false)}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-hairline bg-surface text-[11px] font-mono hover:bg-muted disabled:opacity-50"
          >
            <ExternalLink className="w-3 h-3" /> Emitir link
          </button>
          <button
            onClick={() => void issue(true)}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-hairline bg-surface text-[11px] font-mono hover:bg-muted disabled:opacity-50"
          >
            Rotar
          </button>
        </div>
      </div>
      {issuedUrl && (
        <div className="mt-2 text-[10px] font-mono break-all bg-muted/40 border border-hairline rounded p-2">
          {issuedUrl}
          <div className="text-content-subtle mt-1">
            Copiado al portapapeles · compártelo por email/WhatsApp con la contraparte.
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------- Generar y enviar documento para firma ------------- */
const DEAL_DOCS = [
  { id: "ncnda", label: "NCNDA" },
  { id: "icpo", label: "ICPO" },
  { id: "fco", label: "FCO" },
  { id: "loi", label: "LOI · Carta de intención" },
  { id: "nda", label: "NDA" },
  { id: "spa", label: "SPA · Contrato" },
  { id: "data-sheet", label: "Data sheet" },
] as const;

const SIGN_STATUS_META: Record<string, { label: string; cls: string }> = {
  signed: { label: "Firmado", cls: "bg-brand-success/15 text-brand-success" },
  pending: { label: "Pendiente", cls: "bg-brand-warn/15 text-brand-warn" },
  void: { label: "Anulado", cls: "bg-muted text-content-subtle" },
};

function SendDocPanel({ tradeId }: { tradeId: string }) {
  const listFn = useServerFn(listMySignRequests);
  const { data } = useQuery({
    queryKey: ["sign-requests"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });
  const sent = (data ?? []).filter((r) => r.trade_id === tradeId);

  return (
    <div className="rounded-lg border border-hairline bg-surface-2/20 p-4 mb-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-2 flex items-center gap-1.5">
        <FileSignature className="w-3.5 h-3.5" /> Documentos del acuerdo · firma electrónica
      </div>
      <div className="flex flex-wrap gap-2">
        {DEAL_DOCS.map((d) => (
          <Link
            key={d.id}
            to="/dashboard/documentos/$templateId"
            params={{ templateId: d.id }}
            search={{ trade: tradeId }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-hairline bg-surface text-[11px] font-mono hover:border-accent-brand/60 hover:text-accent-brand"
          >
            <Send className="w-3 h-3" /> {d.label}
          </Link>
        ))}
      </div>

      {sent.length > 0 && (
        <div className="mt-3 pt-3 border-t border-hairline/60 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
            Enviados ({sent.length})
          </div>
          {sent.map((r) => {
            const meta = SIGN_STATUS_META[r.status] ?? SIGN_STATUS_META.pending;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="truncate">{r.title}</div>
                  <div className="text-[10px] text-content-subtle truncate">
                    {r.status === "signed"
                      ? `Firmado por ${r.signed_by_name ?? "—"}${r.signed_at ? ` · ${new Date(r.signed_at).toLocaleDateString("es-CL")}` : ""}`
                      : `Firmante: ${r.signer_name_expected ?? "—"} · ${r.token_prefix}…`}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full ${meta.cls}`}
                >
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-content-subtle mt-2">
        Se abre el editor con la contraparte precargada; al enviar, el documento queda ligado a este
        trade y, al firmarse, avanza el checklist documental.
      </p>
    </div>
  );
}

/* --------------------- Solicitar documentos a contraparte ---------------- */
function RequestDocsPanel({
  tradeId,
  docs,
}: {
  tradeId: string;
  docs: NonNullable<Awaited<ReturnType<typeof getTradeDetail>>>["documents"];
}) {
  const qc = useQueryClient();
  const reqFn = useServerFn(requestTradeDocs);
  const existing = new Set(docs.map((d) => d.doc_type));
  const suggested = DOC_CATALOG.filter((d) => !existing.has(d.key)).slice(0, 8);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = async () => {
    if (!picked.length) return toast.error("Selecciona al menos un documento.");
    setBusy(true);
    try {
      await reqFn({ data: { tradeId, docTypes: picked } });
      toast.success("Solicitud registrada. La contraparte lo verá en su panel.");
      setPicked([]);
      void qc.invalidateQueries({ queryKey: ["trade", tradeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  if (!suggested.length) return null;
  return (
    <div className="rounded-lg border border-hairline bg-surface-2/20 p-4 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" /> Solicitar documentos a contraparte
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy || !picked.length}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-brand text-accent-brand-contrast text-[11px] font-medium hover:bg-accent-brand/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Solicitar ({picked.length})
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggested.map((d) => {
          const on = picked.includes(d.key);
          return (
            <button
              key={d.key}
              onClick={() => toggle(d.key)}
              className={`text-[11px] font-mono px-2 py-1 rounded border transition ${
                on
                  ? "bg-accent-brand/15 border-accent-brand/40 text-accent-brand"
                  : "bg-surface border-hairline text-content hover:bg-muted"
              }`}
              title={d.label}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- Bandeja de subida de documentos ------------------- */
function UploadInboxPanel({
  tradeId,
  docs,
  onChange,
}: {
  tradeId: string;
  docs: NonNullable<Awaited<ReturnType<typeof getTradeDetail>>>["documents"];
  onChange: () => void;
}) {
  const uploadFn = useServerFn(requestTradeDocUpload);
  const upsertFn = useServerFn(upsertTradeDocument);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pending = docs.filter((d) => d.status === "pending");
  const received = docs.filter((d) => d.file_url && d.status !== "pending");

  if (pending.length === 0 && received.length === 0) return null;

  const fileName = (u: string | null) => (u ? (u.split("/").pop() ?? u) : "—");
  const labelOf = (k: string) => DOC_BY_KEY[k]?.acronym ?? DOC_BY_KEY[k]?.label ?? k;

  const upload = async (docType: string, file: File) => {
    setBusyKey(docType);
    try {
      const { path, token, bucket } = await uploadFn({
        data: { tradeId, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (up.error) throw up.error;
      await upsertFn({
        data: { tradeId, docType, fileUrl: path, status: "uploaded" },
      });
      toast.success(`${labelOf(docType)} recibido.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-2/20 p-4 mb-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-3 flex items-center gap-1.5">
        <Upload className="w-3.5 h-3.5" /> Bandeja de subida de documentos
      </div>

      {pending.length > 0 ? (
        <div className="space-y-2 mb-3">
          {pending.map((d) => (
            <UploadInboxRow
              key={d.id}
              docType={d.doc_type}
              label={labelOf(d.doc_type)}
              full={DOC_BY_KEY[d.doc_type]?.label ?? d.doc_type}
              busy={busyKey === d.doc_type}
              onFile={(f) => void upload(d.doc_type, f)}
            />
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-content-subtle mb-3">
          Sin documentos pendientes de subir.
        </div>
      )}

      {received.length > 0 && (
        <>
          <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mt-4 mb-2">
            Recibidos
          </div>
          <div className="rounded border border-hairline divide-y divide-border">
            {received.map((d) => (
              <div
                key={d.id}
                className="p-2 flex items-center justify-between gap-2 text-[11px] font-mono"
              >
                <div className="min-w-0">
                  <span className="text-accent-brand">{labelOf(d.doc_type)}</span>
                  <span className="text-content ml-2 truncate">{fileName(d.file_url)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-content-subtle">
                    {new Date(d.updated_at).toLocaleString("es-CL")}
                  </span>
                  <DocStatusPill status={d.status} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UploadInboxRow({
  docType: _docType,
  label,
  full,
  busy,
  onFile,
}: {
  docType: string;
  label: string;
  full: string;
  busy: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex items-center justify-between gap-3 p-2.5 rounded border transition ${
        drag ? "border-accent-brand bg-accent-brand/5" : "border-dashed border-hairline bg-surface"
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium">
          <span className="font-mono text-accent-brand mr-1.5">{label}</span>
          <span className="text-content">{full}</span>
        </div>
        <div className="text-[10px] text-content-subtle font-mono mt-0.5">
          Pendiente · arrastra el archivo aquí o selecciónalo
        </div>
      </div>
      <div className="shrink-0">
        <input
          ref={ref}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-brand text-accent-brand-contrast text-[11px] font-medium hover:bg-accent-brand/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          Subir archivo
        </button>
      </div>
    </div>
  );
}

/* -------------------- Selector / alta rápida de proveedor --------------- */
function SupplierPanel({
  tradeId,
  currentName,
  onLinked,
}: {
  tradeId: string;
  currentName: string | null;
  onLinked: () => void;
}) {
  const listFn = useServerFn(listPartners);
  const upsertFn = useServerFn(upsertPartner);
  const linkFn = useServerFn(linkPartnerToTrade);
  const onboardFn = useServerFn(sendSupplierOnboarding);
  const { data, refetch } = useQuery({
    queryKey: ["partners-list"],
    queryFn: () => listFn(),
  });
  const partners = data?.partners ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const [onboarding, setOnboarding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "proveedor" as (typeof PARTNER_ROLES)[number],
    email: "",
    phone: "",
    country: "",
  });

  const link = async (partnerId: string) => {
    setBusy(true);
    try {
      await linkFn({ data: { tradeId, partnerId } });
      toast.success("Proveedor vinculado al trade.");
      onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo vincular");
    } finally {
      setBusy(false);
    }
  };

  const createAndLink = async () => {
    if (form.name.trim().length < 2) return toast.error("Nombre requerido.");
    setBusy(true);
    try {
      const { id } = await upsertFn({
        data: {
          name: form.name.trim(),
          company: form.company.trim() || undefined,
          role: form.role,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          status: "activo",
        },
      });
      await linkFn({ data: { tradeId, partnerId: id } });
      toast.success("Proveedor creado y vinculado.");
      setCreating(false);
      setForm({ name: "", company: "", role: "proveedor", email: "", phone: "", country: "" });
      void refetch();
      onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const sendOnboarding = async () => {
    setOnboarding(true);
    try {
      const partnerId = selectedId || undefined;
      const partner = partners.find((p) => p.id === selectedId);
      let overrideEmail: string | undefined;
      let overrideName: string | undefined;
      if (!partnerId || !partner?.email) {
        const ask = window.prompt(
          "Email del proveedor para enviar NDA + LOI + link del Portal:",
          partner?.email ?? "",
        );
        if (!ask) {
          setOnboarding(false);
          return;
        }
        overrideEmail = ask.trim();
        overrideName = partner?.name;
      }
      const res = await onboardFn({
        data: { tradeId, partnerId, overrideEmail, overrideName },
      });
      if (res.emailed) {
        toast.success(`NDA + LOI + Portal enviados a ${res.recipient}`);
      } else {
        toast.message("Solicitudes creadas — el envío por email quedó pendiente.", {
          description: `NDA: ${res.nda.signUrl.slice(0, 42)}… · LOI: ${res.loi.signUrl.slice(0, 42)}…`,
        });
      }
      onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el onboarding");
    } finally {
      setOnboarding(false);
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-2/20 p-4 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
          Proveedor / contraparte del trade
        </div>
        {currentName && (
          <div className="text-[11px] font-mono text-content truncate">
            Actual: <b>{currentName}</b>
          </div>
        )}
      </div>

      {!creating ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`${inputCls} min-w-[220px]`}
            disabled={busy || partners.length === 0}
          >
            <option value="">
              {partners.length ? "Seleccionar de mi cartera…" : "Sin proveedores guardados"}
            </option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.company ? ` · ${p.company}` : ""}
                {p.role ? ` · ${p.role}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedId && void link(selectedId)}
            disabled={!selectedId || busy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-brand text-accent-brand-contrast text-[11px] font-medium hover:bg-accent-brand/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Vincular al trade
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-hairline bg-surface text-[11px] font-mono hover:bg-muted"
          >
            <Plus className="w-3 h-3" /> Nuevo proveedor
          </button>
          <button
            onClick={() => void sendOnboarding()}
            disabled={onboarding || busy}
            title="Envía en un mail al proveedor: NDA + LOI para firma electrónica + link del Portal Proveedor para carga documental."
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-brand text-accent-brand-contrast text-[11px] font-medium hover:bg-accent-brand/90 disabled:opacity-50"
          >
            {onboarding ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Enviar NDA + LOI + Portal
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          <F label="Nombre *">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              placeholder="Nombre completo"
            />
          </F>
          <F label="Empresa">
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={inputCls}
              placeholder="Razón social"
            />
          </F>
          <F label="Rol">
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as (typeof PARTNER_ROLES)[number] })
              }
              className={inputCls}
            >
              {PARTNER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </F>
          <F label="País (ISO)">
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className={inputCls}
              placeholder="CL, AE, CN…"
            />
          </F>
          <F label="Email">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
              placeholder="contacto@empresa.com"
            />
          </F>
          <F label="Teléfono">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
              placeholder="+56 9 …"
            />
          </F>
          <div className="sm:col-span-2 flex items-center gap-2 justify-end">
            <button
              onClick={() => setCreating(false)}
              disabled={busy}
              className="px-2.5 py-1 rounded border border-hairline bg-surface text-[11px] font-mono hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={() => void createAndLink()}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent-brand text-accent-brand-contrast text-[11px] font-medium hover:bg-accent-brand/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Crear y vincular
            </button>
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-content-subtle font-mono">
        Al vincular se actualizan los campos de contraparte del trade; luego emite el link de
        operación abajo para compartirlo por email/WhatsApp.
      </div>
    </div>
  );
}

function OnboardingBadge({ s }: { s?: OnboardingStatus }) {
  if (!s || s.state === "pending") return null;
  const map: Record<OnboardingStatus["state"], { label: string; cls: string }> = {
    pending: { label: "", cls: "" },
    sent: {
      label: "NDA+LOI enviado",
      cls: "bg-brand-warn/10 text-brand-warn border-brand-warn/30",
    },
    partial: {
      label: s.ndaSigned ? "NDA firmado" : "LOI firmado",
      cls: "bg-brand-info/10 text-brand-info border-brand-info/30",
    },
    signed: {
      label: "NDA+LOI firmado",
      cls: "bg-brand-success/10 text-brand-success border-brand-success/30",
    },
  };
  const m = map[s.state];
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.cls}`}
      title={s.sentAt ? `Enviado ${new Date(s.sentAt).toLocaleDateString("es-CL")}` : undefined}
    >
      {m.label}
    </span>
  );
}

// ---------- Panel de estado de entrega (envío / apertura) ----------
const TEMPLATE_LABEL: Record<string, string> = {
  "supplier-onboarding": "Onboarding proveedor (NDA + LOI + Portal)",
  "antimony-product-sheet": "Ficha técnica antimonio",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AntimonyDeliveryPanel({
  rows,
  loading,
  onRefresh,
}: {
  rows: DeliveryRow[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (rows.length === 0 && !loading) {
    return (
      <div className="mt-3 text-[11px] font-mono text-content-subtle border-t border-accent-brand/20 pt-2">
        Aún no se ha despachado el paquete. Al enviarlo aparecerá aquí el estado (enviado /
        abierto).
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-accent-brand/20 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
          Confirmación de entrega y lectura
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[10px] font-mono text-content-subtle hover:text-content disabled:opacity-50"
          title="Refrescar estado"
        >
          {loading ? "Actualizando…" : "Refrescar"}
        </button>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const opened = !!r.openedAt;
          const sentOk = r.status === "sent" || r.status === "pending" || opened;
          const failed =
            r.status === "failed" ||
            r.status === "dlq" ||
            r.status === "bounced" ||
            r.status === "complained";
          return (
            <div
              key={`${r.templateName}::${r.recipient}`}
              className="flex items-center justify-between gap-2 text-[11px] bg-surface-2 rounded px-2 py-1"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-content truncate">{r.recipient}</div>
                <div className="text-[10px] text-content-subtle truncate">
                  {TEMPLATE_LABEL[r.templateName] ?? r.templateName}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusBadge
                  ok={sentOk && !failed}
                  fail={failed}
                  label={failed ? "Falló" : r.status === "pending" ? "En cola" : "Enviado"}
                  time={r.sentAt}
                />
                <StatusBadge
                  ok={opened}
                  neutral={!opened}
                  label={opened ? "Abierto" : "Sin apertura"}
                  time={r.openedAt}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 text-[10px] text-content-subtle">
        La apertura se detecta con un pixel de tracking. Algunos clientes de correo (Gmail con proxy
        de imágenes, Outlook con imágenes bloqueadas) pueden retrasar u ocultar la confirmación.
      </div>
    </div>
  );
}

function StatusBadge({
  ok,
  fail,
  neutral,
  label,
  time,
}: {
  ok?: boolean;
  fail?: boolean;
  neutral?: boolean;
  label: string;
  time?: string | null;
}) {
  const cls = fail
    ? "bg-brand-danger/15 text-brand-danger border-brand-danger/30"
    : ok
      ? "bg-brand-success/15 text-brand-success border-brand-success/30"
      : neutral
        ? "bg-muted text-content-subtle border-hairline"
        : "bg-muted text-content-subtle border-hairline";
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
      title={time ? fmtDate(time) : undefined}
    >
      {ok ? "✓" : fail ? "✕" : "•"} {label}
      {time ? ` · ${fmtDate(time)}` : ""}
    </span>
  );
}
