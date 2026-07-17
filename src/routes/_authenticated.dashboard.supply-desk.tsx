import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Factory,
  Plus,
  Loader2,
  Info,
  Users,
  Target,
  Link2,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QueryError } from "@/components/ui/QueryError";
import {
  getSupplyDesk,
  upsertMandate,
  upsertPartner,
  createMatch,
  updateMatch,
  type MandateRow,
  type PartnerRow,
  type MatchRow,
} from "@/lib/supplyDesk.functions";
import {
  MANDATE_STATUS_LABEL,
  MANDATE_FREQUENCY_LABEL,
  PARTNER_TYPE_LABEL,
  VETTING_STATUS_LABEL,
  MATCH_STAGES,
  MATCH_STAGE_LABEL,
  MANDATE_TEMPLATES,
  COMMODITY_FORMS,
  mandateCoverage,
  matchStageIndex,
  type MandateStatus,
  type VettingStatus,
  type MatchStage,
} from "@/lib/supplyDesk";

export const Route = createFileRoute("/_authenticated/dashboard/supply-desk")({
  head: () => ({ meta: [{ title: "Mesa de Origen — Geocapitals" }] }),
  component: SupplyDeskPage,
});

const fmtUsd = (n: number | null | undefined) =>
  n == null ? "—" : `US$ ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtT = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`;

type Tab = "mandatos" | "proveedores";

function SupplyDeskPage() {
  const [tab, setTab] = useState<Tab>("mandatos");
  const deskFn = useServerFn(getSupplyDesk);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["supply-desk"],
    queryFn: () => deskFn(),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <header className="mb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </Link>
        <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
          <Factory className="w-5 h-5 text-gold" /> Mesa de Origen · demanda y proveedores
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Estructura los deals de commodities: mandatos de compra (demanda real), red de
          asociados/proveedores de materia prima y el pipeline de matching hasta convertirlos en un
          trade del Trade Desk.
        </p>
      </header>

      <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-500 mb-4 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Registro y trazabilidad de la originación. Cuando un match llega a etapa Trade, la
        compraventa se gestiona con su ciclo documental (ICPO · FCO · SPA · SBLC/DLC) en el{" "}
        <Link to="/dashboard/trades" className="underline">
          Trade Desk
        </Link>
        .
      </div>

      {isError ? (
        <QueryError message="No pudimos cargar la mesa de origen." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <KpiStrip mandates={data.mandates} partners={data.partners} matches={data.matches} />
          <div className="flex items-center gap-1 mb-4 border-b border-border">
            <TabBtn active={tab === "mandatos"} onClick={() => setTab("mandatos")}>
              <Target className="w-3.5 h-3.5" /> Mandatos & Matching ({data.mandates.length})
            </TabBtn>
            <TabBtn active={tab === "proveedores"} onClick={() => setTab("proveedores")}>
              <Users className="w-3.5 h-3.5" /> Red de Proveedores ({data.partners.length})
            </TabBtn>
          </div>
          {tab === "mandatos" ? (
            <MandatesTab mandates={data.mandates} partners={data.partners} matches={data.matches} />
          ) : (
            <PartnersTab partners={data.partners} />
          )}
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function KpiStrip({
  mandates,
  partners,
  matches,
}: {
  mandates: MandateRow[];
  partners: PartnerRow[];
  matches: MatchRow[];
}) {
  const active = mandates.filter((m) => m.status === "active").length;
  const verified = partners.filter((p) => p.vetting_status === "verified").length;
  const inPipeline = matches.filter((m) => m.stage !== "dropped" && m.stage !== "trade").length;
  const asTrades = matches.filter((m) => m.stage === "trade").length;
  const kpis = [
    { label: "Mandatos activos", value: active },
    { label: "Proveedores en red", value: partners.length },
    { label: "Verificados KYC", value: verified },
    { label: "Matches en pipeline", value: inPipeline },
    { label: "Convertidos a trade", value: asTrades },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-bg-secondary/30 p-3">
          <div className="text-lg font-bold">{k.value}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {k.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Mandatos & Matching ----------------

const emptyMandateForm = {
  id: undefined as string | undefined,
  reference: "",
  title: "",
  commodity: "Cu",
  form: "concentrate",
  spec: "",
  quantityT: "",
  frequency: "monthly" as "spot" | "monthly" | "quarterly" | "annual",
  incoterm: "CIF",
  destination: "",
  targetPriceUsd: "",
  priceBasis: "",
  paymentInstrument: "dlc",
  buyerCompany: "",
  buyerContact: "",
  notes: "",
};

function MandatesTab({
  mandates,
  partners,
  matches,
}: {
  mandates: MandateRow[];
  partners: PartnerRow[];
  matches: MatchRow[];
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertMandate);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyMandateForm);

  const applyTemplate = (key: string) => {
    const t = MANDATE_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setForm({
      ...emptyMandateForm,
      title: t.values.title,
      commodity: t.values.commodity,
      form: t.values.form,
      spec: t.values.spec,
      destination: t.values.destination,
      frequency: t.values.frequency,
      incoterm: t.values.incoterm,
      paymentInstrument: t.values.paymentInstrument,
      priceBasis: t.values.priceBasis,
    });
    setShowForm(true);
  };

  const editMandate = (m: MandateRow) => {
    setForm({
      id: m.id,
      reference: m.reference ?? "",
      title: m.title,
      commodity: m.commodity,
      form: m.form ?? "",
      spec: m.spec ?? "",
      quantityT: m.quantity_t != null ? String(m.quantity_t) : "",
      frequency: (m.frequency as typeof emptyMandateForm.frequency) ?? "spot",
      incoterm: m.incoterm ?? "",
      destination: m.destination ?? "",
      targetPriceUsd: m.target_price_usd != null ? String(m.target_price_usd) : "",
      priceBasis: m.price_basis ?? "",
      paymentInstrument: m.payment_instrument ?? "dlc",
      buyerCompany: m.buyer_company ?? "",
      buyerContact: m.buyer_contact ?? "",
      notes: m.notes ?? "",
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (form.title.trim().length < 3) return toast.error("Indica el título del mandato");
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: form.id,
          reference: form.reference.trim() || undefined,
          title: form.title.trim(),
          commodity: form.commodity.trim(),
          form: form.form || undefined,
          spec: form.spec.trim() || undefined,
          quantityT: form.quantityT ? Number(form.quantityT) : undefined,
          frequency: form.frequency,
          incoterm: form.incoterm || undefined,
          destination: form.destination.trim() || undefined,
          targetPriceUsd: form.targetPriceUsd ? Number(form.targetPriceUsd) : undefined,
          priceBasis: form.priceBasis.trim() || undefined,
          paymentInstrument: form.paymentInstrument || undefined,
          buyerCompany: form.buyerCompany.trim() || undefined,
          buyerContact: form.buyerContact.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      toast.success(form.id ? "Mandato actualizado." : "Mandato creado.");
      setShowForm(false);
      setForm(emptyMandateForm);
      void qc.invalidateQueries({ queryKey: ["supply-desk"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Plantillas de demanda:
          </span>
          {MANDATE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => applyTemplate(t.key)}
              className="px-2 py-1 rounded text-[10px] font-mono border border-gold/40 text-gold hover:bg-gold/10"
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setForm(emptyMandateForm);
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo mandato
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-bg-secondary/30 p-4 mb-4 grid sm:grid-cols-2 gap-2">
          <F label="Título del mandato" full>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Antimonio para refinería en Florida, USA"
              className={inputCls}
            />
          </F>
          <F label="Folio (opcional)">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="MND-2026-001"
              className={inputCls}
            />
          </F>
          <F label="Commodity">
            <input
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
              placeholder="Sb / Cu / Au"
              className={inputCls}
            />
          </F>
          <F label="Forma">
            <select
              value={form.form}
              onChange={(e) => setForm({ ...form, form: e.target.value })}
              className={inputCls}
            >
              {COMMODITY_FORMS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
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
          <F label="Frecuencia">
            <select
              value={form.frequency}
              onChange={(e) =>
                setForm({ ...form, frequency: e.target.value as typeof form.frequency })
              }
              className={inputCls}
            >
              {Object.entries(MANDATE_FREQUENCY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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
          <F label="Destino">
            <input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="Refinería, Florida, USA"
              className={inputCls}
            />
          </F>
          <F label="Precio objetivo USD/t">
            <input
              type="number"
              value={form.targetPriceUsd}
              onChange={(e) => setForm({ ...form, targetPriceUsd: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Base de precio">
            <input
              value={form.priceBasis}
              onChange={(e) => setForm({ ...form, priceBasis: e.target.value })}
              placeholder="LME Cash menos descuento"
              className={inputCls}
            />
          </F>
          <F label="Instrumento de pago">
            <select
              value={form.paymentInstrument}
              onChange={(e) => setForm({ ...form, paymentInstrument: e.target.value })}
              className={inputCls}
            >
              <option value="sblc_mt760">SBLC (MT760)</option>
              <option value="dlc">DLC</option>
              <option value="tt">TT</option>
              <option value="escrow">Escrow</option>
            </select>
          </F>
          <F label="Comprador (empresa)">
            <input
              value={form.buyerCompany}
              onChange={(e) => setForm({ ...form, buyerCompany: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Contacto comprador">
            <input
              value={form.buyerContact}
              onChange={(e) => setForm({ ...form, buyerContact: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Especificación (ley, impurezas, norma)" full>
            <textarea
              value={form.spec}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
              rows={2}
              className={inputCls}
            />
          </F>
          <F label="Notas" full>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={inputCls}
            />
          </F>
          <div className="sm:col-span-2">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}{" "}
              {form.id ? "Guardar cambios" : "Crear mandato"}
            </button>
          </div>
        </div>
      )}

      {mandates.length === 0 ? (
        <Empty>
          Sin mandatos todavía. Usa una plantilla de demanda (antimonio Florida, cátodo Cu,
          concentrado Cu, oro doré) o crea uno nuevo para empezar a asignar proveedores.
        </Empty>
      ) : (
        <div className="space-y-3">
          {mandates.map((m) => (
            <MandateCard
              key={m.id}
              mandate={m}
              partners={partners}
              matches={matches.filter((x) => x.mandate_id === m.id)}
              onEdit={() => editMandate(m)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MandateCard({
  mandate,
  partners,
  matches,
  onEdit,
}: {
  mandate: MandateRow;
  partners: PartnerRow[];
  matches: MatchRow[];
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertMandate);
  const createMatchFn = useServerFn(createMatch);
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  const activeMatches = matches.filter((x) => x.stage !== "dropped");
  const coverage = mandateCoverage(mandate.quantity_t, matches);
  const partnersById = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);
  const availablePartners = partners.filter(
    (p) => !matches.some((x) => x.partner_id === p.id),
  );

  const refresh = () => void qc.invalidateQueries({ queryKey: ["supply-desk"] });

  const setStatus = async (status: MandateStatus) => {
    try {
      await upsertFn({
        data: { id: mandate.id, title: mandate.title, commodity: mandate.commodity, status },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const connect = async () => {
    if (!partnerId) return;
    setConnecting(true);
    try {
      await createMatchFn({ data: { mandateId: mandate.id, partnerId } });
      setPartnerId("");
      toast.success("Proveedor conectado al mandato.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-secondary/30">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">
              {mandate.reference && (
                <span className="font-mono text-gold mr-1.5">{mandate.reference}</span>
              )}
              {mandate.title}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {mandate.commodity} · {mandate.form ?? "—"} · {fmtT(mandate.quantity_t)}{" "}
              {MANDATE_FREQUENCY_LABEL[mandate.frequency as keyof typeof MANDATE_FREQUENCY_LABEL] ??
                mandate.frequency}{" "}
              · {mandate.incoterm ?? "—"} · {mandate.destination ?? "—"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={mandate.status} />
            <div className="w-24 text-right">
              <div className="text-[10px] font-mono text-muted-foreground">
                {activeMatches.length} match(es)
                {coverage.pct != null && ` · ${coverage.pct}%`}
              </div>
              <div className="h-1 rounded bg-muted/40 overflow-hidden mt-0.5">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${coverage.pct ?? 0}%` }}
                />
              </div>
            </div>
            {open ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-3">
            <KV k="Especificación" v={mandate.spec} />
            <KV k="Base de precio" v={mandate.price_basis} />
            <KV k="Precio objetivo" v={mandate.target_price_usd ? fmtUsd(mandate.target_price_usd) : null} />
            <KV k="Pago" v={mandate.payment_instrument} />
            <KV k="Comprador" v={mandate.buyer_company} />
            <KV k="Contacto" v={mandate.buyer_contact} />
            {mandate.notes && <KV k="Notas" v={mandate.notes} full />}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground"
            >
              Editar
            </button>
            {(["active", "paused", "fulfilled", "closed"] as MandateStatus[])
              .filter((s) => s !== mandate.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => void setStatus(s)}
                  className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground"
                >
                  → {MANDATE_STATUS_LABEL[s]}
                </button>
              ))}
          </div>

          {/* Conectar proveedor */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className={`${inputCls} !w-auto min-w-[220px]`}
            >
              <option value="">Conectar proveedor de la red…</option>
              {availablePartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name} · {p.commodities.join("/") || "—"} ·{" "}
                  {VETTING_STATUS_LABEL[p.vetting_status as VettingStatus] ?? p.vetting_status}
                </option>
              ))}
            </select>
            <button
              onClick={() => void connect()}
              disabled={!partnerId || connecting}
              className="px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Conectar
            </button>
            {availablePartners.length === 0 && partners.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Todos los proveedores ya están conectados.
              </span>
            )}
          </div>

          {/* Pipeline de matches */}
          {matches.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              Sin proveedores conectados a este mandato todavía.
            </div>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {matches.map((match) => (
                <MatchRowView
                  key={match.id}
                  match={match}
                  partner={partnersById.get(match.partner_id)}
                  onChange={refresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRowView({
  match,
  partner,
  onChange,
}: {
  match: MatchRow;
  partner: PartnerRow | undefined;
  onChange: () => void;
}) {
  const updateFn = useServerFn(updateMatch);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(match.offered_quantity_t != null ? String(match.offered_quantity_t) : "");
  const [price, setPrice] = useState(match.offered_price_usd != null ? String(match.offered_price_usd) : "");
  const [assay, setAssay] = useState(match.assay_summary ?? "");
  const [nextAction, setNextAction] = useState(match.next_action ?? "");

  const save = async (extra?: { stage?: MatchStage }) => {
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: match.id,
          stage: extra?.stage,
          offeredQuantityT: qty ? Number(qty) : null,
          offeredPriceUsd: price ? Number(price) : null,
          assaySummary: assay.trim() || null,
          nextAction: nextAction.trim() || null,
        },
      });
      toast.success("Match actualizado.");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (stage: MatchStage) => {
    setBusy(true);
    try {
      await updateFn({ data: { id: match.id, stage } });
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const idx = matchStageIndex(match.stage);
  const dropped = match.stage === "dropped";

  return (
    <div className="p-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">
            {partner?.company_name ?? "Proveedor"}
            {partner && (
              <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                {PARTNER_TYPE_LABEL[partner.partner_type as keyof typeof PARTNER_TYPE_LABEL] ??
                  partner.partner_type}
                {partner.vetting_status === "verified" && (
                  <ShieldCheck className="w-3 h-3 inline ml-1 text-emerald-500" />
                )}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {fmtT(match.offered_quantity_t)} · {fmtUsd(match.offered_price_usd)}/t
            {match.next_action ? ` · Próximo: ${match.next_action}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={match.stage}
            onChange={(e) => void setStage(e.target.value as MatchStage)}
            disabled={busy}
            className={`px-1.5 py-1 rounded text-[10px] font-mono border bg-background ${
              dropped
                ? "text-red-500 border-red-500/40"
                : match.stage === "trade"
                  ? "text-emerald-600 border-emerald-500/40"
                  : "text-primary border-primary/40"
            }`}
          >
            {MATCH_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
            <option value="dropped">{MATCH_STAGE_LABEL.dropped}</option>
          </select>
          {match.trade_id && (
            <Link
              to="/dashboard/trades/$tradeId"
              params={{ tradeId: match.trade_id }}
              className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Trade <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground"
          >
            {open ? "Cerrar" : "Detalle"}
          </button>
        </div>
      </div>

      {!dropped && (
        <div className="flex items-center gap-0.5 mt-1.5">
          {MATCH_STAGES.map((s, i) => (
            <span
              key={s.key}
              title={s.label}
              className={`h-1 flex-1 rounded ${i <= idx ? "bg-primary" : "bg-muted/40"}`}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <F label="Cantidad ofrecida (t)">
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
          </F>
          <F label="Precio ofrecido USD/t">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </F>
          <F label="Resumen ensayo / muestra" full>
            <input
              value={assay}
              onChange={(e) => setAssay(e.target.value)}
              placeholder="SGS n° … · ley, impurezas"
              className={inputCls}
            />
          </F>
          <F label="Próxima acción" full>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Enviar NCNDA / coordinar muestra…"
              className={inputCls}
            />
          </F>
          <div className="sm:col-span-2">
            <button
              onClick={() => void save()}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Red de Proveedores ----------------

const emptyPartnerForm = {
  id: undefined as string | undefined,
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  country: "",
  region: "",
  partnerType: "producer" as "producer" | "trader" | "aggregator" | "agent" | "refiner",
  commodities: "",
  forms: "",
  monthlyCapacityT: "",
  kycNotes: "",
  notes: "",
};

function PartnersTab({ partners }: { partners: PartnerRow[] }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPartner);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyPartnerForm);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["supply-desk"] });

  const editPartner = (p: PartnerRow) => {
    setForm({
      id: p.id,
      companyName: p.company_name,
      contactName: p.contact_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      country: p.country ?? "",
      region: p.region ?? "",
      partnerType: (p.partner_type as typeof emptyPartnerForm.partnerType) ?? "producer",
      commodities: p.commodities.join(", "),
      forms: p.forms.join(", "),
      monthlyCapacityT: p.monthly_capacity_t != null ? String(p.monthly_capacity_t) : "",
      kycNotes: p.kyc_notes ?? "",
      notes: p.notes ?? "",
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (form.companyName.trim().length < 2) return toast.error("Indica el nombre de la empresa");
    setSaving(true);
    try {
      const csv = (s: string) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      await upsertFn({
        data: {
          id: form.id,
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim() || undefined,
          email: form.email.trim() || "",
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          region: form.region.trim() || undefined,
          partnerType: form.partnerType,
          commodities: csv(form.commodities),
          forms: csv(form.forms),
          monthlyCapacityT: form.monthlyCapacityT ? Number(form.monthlyCapacityT) : undefined,
          kycNotes: form.kycNotes.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      toast.success(form.id ? "Proveedor actualizado." : "Proveedor agregado a la red.");
      setShowForm(false);
      setForm(emptyPartnerForm);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const setVetting = async (p: PartnerRow, vettingStatus: VettingStatus) => {
    try {
      await upsertFn({
        data: {
          id: p.id,
          companyName: p.company_name,
          partnerType: (p.partner_type as typeof emptyPartnerForm.partnerType) ?? "producer",
          commodities: p.commodities,
          forms: p.forms,
          vettingStatus,
        },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => {
            setForm(emptyPartnerForm);
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar proveedor
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-bg-secondary/30 p-4 mb-4 grid sm:grid-cols-2 gap-2">
          <F label="Empresa" full>
            <input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Minera / trader / agente"
              className={inputCls}
            />
          </F>
          <F label="Contacto">
            <input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Email">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Teléfono">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Tipo">
            <select
              value={form.partnerType}
              onChange={(e) =>
                setForm({ ...form, partnerType: e.target.value as typeof form.partnerType })
              }
              className={inputCls}
            >
              {Object.entries(PARTNER_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </F>
          <F label="País">
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder="Chile"
              className={inputCls}
            />
          </F>
          <F label="Región / zona">
            <input
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Commodities (separadas por coma)">
            <input
              value={form.commodities}
              onChange={(e) => setForm({ ...form, commodities: e.target.value })}
              placeholder="Cu, Au, Sb"
              className={inputCls}
            />
          </F>
          <F label="Formas (separadas por coma)">
            <input
              value={form.forms}
              onChange={(e) => setForm({ ...form, forms: e.target.value })}
              placeholder="concentrate, dore"
              className={inputCls}
            />
          </F>
          <F label="Capacidad mensual (t)">
            <input
              type="number"
              value={form.monthlyCapacityT}
              onChange={(e) => setForm({ ...form, monthlyCapacityT: e.target.value })}
              className={inputCls}
            />
          </F>
          <F label="Notas KYC" full>
            <textarea
              value={form.kycNotes}
              onChange={(e) => setForm({ ...form, kycNotes: e.target.value })}
              rows={2}
              placeholder="Documentos recibidos, referencias, verificación de origen…"
              className={inputCls}
            />
          </F>
          <F label="Notas" full>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={inputCls}
            />
          </F>
          <div className="sm:col-span-2">
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}{" "}
              {form.id ? "Guardar cambios" : "Agregar a la red"}
            </button>
          </div>
        </div>
      )}

      {partners.length === 0 ? (
        <Empty>
          Sin proveedores en la red todavía. Agrega los asociados que son (o consiguen) proveedores
          de materia prima y gestiona su vetting KYC antes de asignarlos a un mandato.
        </Empty>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {partners.map((p) => (
            <div key={p.id} className="p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">
                  {p.company_name}
                  <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                    {PARTNER_TYPE_LABEL[p.partner_type as keyof typeof PARTNER_TYPE_LABEL] ??
                      p.partner_type}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {p.commodities.join("/") || "—"} · {p.forms.join("/") || "—"} ·{" "}
                  {p.monthly_capacity_t != null ? `${p.monthly_capacity_t} t/mes` : "cap. —"} ·{" "}
                  {[p.region, p.country].filter(Boolean).join(", ") || "—"}
                  {p.contact_name ? ` · ${p.contact_name}` : ""}
                  {p.email ? ` · ${p.email}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={p.vetting_status}
                  onChange={(e) => void setVetting(p, e.target.value as VettingStatus)}
                  className={`px-1.5 py-1 rounded text-[10px] font-mono border bg-background ${
                    p.vetting_status === "verified"
                      ? "text-emerald-600 border-emerald-500/40"
                      : p.vetting_status === "rejected"
                        ? "text-red-500 border-red-500/40"
                        : "text-amber-600 border-amber-500/40"
                  }`}
                >
                  {Object.entries(VETTING_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => editPartner(p)}
                  className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- UI helpers ----------------

const inputCls =
  "w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary";

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
      <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function KV({ k, v, full }: { k: string; v: string | null | undefined; full?: boolean }) {
  if (!v) return null;
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <span className="font-mono uppercase tracking-wider text-muted-foreground text-[10px]">
        {k}:
      </span>{" "}
      <span className="text-foreground">{v}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
      : status === "fulfilled"
        ? "text-sky-600 border-sky-500/40 bg-sky-500/10"
        : status === "paused" || status === "draft"
          ? "text-amber-600 border-amber-500/40 bg-amber-500/10"
          : "text-muted-foreground border-border";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border whitespace-nowrap ${tone}`}>
      {MANDATE_STATUS_LABEL[status as MandateStatus] ?? status}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
      {children}
    </div>
  );
}
