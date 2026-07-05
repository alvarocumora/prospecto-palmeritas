import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, MessageSquare, Package, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createCommodityLot,
  listMyCommodityLots,
  type CreateLotInput,
  type MyCommodityLotRow,
} from "@/lib/myCommodityLots.functions";
import {
  COMMODITIES,
  FORMS,
  FREQUENCIES,
  INCOTERMS,
  commodityLabel,
  formLabel,
  formatTonnes,
} from "@/lib/commodityLabels";

export const Route = createFileRoute("/_authenticated/dashboard/commodity-lots")({
  head: () => ({ meta: [{ title: "Mis lotes de commodities — Geocapitals" }] }),
  component: MyCommodityLotsPage,
});

const EMPTY_FORM = {
  title: "",
  commodity: "cu_concentrate",
  form: "concentrate",
  country: "CL",
  region: "",
  grade_pct: "",
  moisture_pct: "",
  tonnage_available_t: "",
  lot_size_t: "",
  frequency: "spot",
  incoterm: "FOB",
  port_of_loading: "",
  price_basis: "",
  premium_discount_usd_t: "",
  asking_price_usd: "",
  payment_terms: "",
  summary: "",
  description: "",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "border-border text-muted-foreground" },
  pending_verification: { label: "En verificación", cls: "border-warn/40 bg-warn/10 text-warn" },
  published: { label: "Publicado", cls: "border-teal/40 bg-teal/10 text-teal" },
  under_negotiation: { label: "En negociación", cls: "border-gold/40 bg-gold/10 text-gold" },
  sold: { label: "Vendido", cls: "border-border text-muted-foreground" },
  archived: { label: "Archivado", cls: "border-border text-muted-foreground" },
};

function MyCommodityLotsPage() {
  const [rows, setRows] = useState<MyCommodityLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyCommodityLots());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando lotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CreateLotInput = {
        title: form.title,
        commodity: form.commodity as CreateLotInput["commodity"],
        form: form.form as CreateLotInput["form"],
        country: form.country,
        region: form.region || null,
        grade_pct: num(form.grade_pct),
        moisture_pct: num(form.moisture_pct),
        tonnage_available_t: num(form.tonnage_available_t),
        lot_size_t: num(form.lot_size_t),
        frequency: (form.frequency || null) as CreateLotInput["frequency"],
        incoterm: (form.incoterm || null) as CreateLotInput["incoterm"],
        port_of_loading: form.port_of_loading || null,
        price_basis: form.price_basis || null,
        premium_discount_usd_t: num(form.premium_discount_usd_t),
        asking_price_usd: num(form.asking_price_usd),
        payment_terms: form.payment_terms || null,
        summary: form.summary || null,
        description: form.description || null,
      };
      await createCommodityLot({ data: payload });
      toast.success("Lote enviado a verificación. El equipo lo revisará antes de publicar.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el lote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
            <Package className="w-5 h-5 text-gold" /> Mis lotes de commodities
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Publica lotes de concentrados, cátodos, doré y minerales críticos. Cada lote pasa por
            verificación de certificaciones antes de aparecer en el marketplace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-panel px-3 py-1.5 text-xs font-mono hover:border-gold/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded bg-gold text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-gold/90"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo lote
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded border border-border bg-bg-panel p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <Field label="Título del lote *" className="sm:col-span-2 lg:col-span-3">
            <input
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              className="inp"
              placeholder="Concentrado Cu 28% · 500 t/mes · FOB Antofagasta"
            />
          </Field>
          <Field label="Commodity *">
            <select
              value={form.commodity}
              onChange={(e) => set("commodity")(e.target.value)}
              className="inp"
            >
              {Object.entries(COMMODITIES).map(([v, m]) => (
                <option key={v} value={v}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma *">
            <select value={form.form} onChange={(e) => set("form")(e.target.value)} className="inp">
              {Object.entries(FORMS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="País (código) *">
            <input
              required
              maxLength={80}
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
              className="inp"
              placeholder="CL, PE, BR…"
            />
          </Field>
          <Field label="Región">
            <input
              maxLength={120}
              value={form.region}
              onChange={(e) => set("region")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Ley (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.grade_pct}
              onChange={(e) => set("grade_pct")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Humedad (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.moisture_pct}
              onChange={(e) => set("moisture_pct")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Disponible (t)">
            <input
              type="number"
              min={0}
              step="any"
              value={form.tonnage_available_t}
              onChange={(e) => set("tonnage_available_t")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Tamaño de lote (t)">
            <input
              type="number"
              min={0}
              step="any"
              value={form.lot_size_t}
              onChange={(e) => set("lot_size_t")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Frecuencia">
            <select
              value={form.frequency}
              onChange={(e) => set("frequency")(e.target.value)}
              className="inp"
            >
              {Object.entries(FREQUENCIES).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Incoterm">
            <select
              value={form.incoterm}
              onChange={(e) => set("incoterm")(e.target.value)}
              className="inp"
            >
              {INCOTERMS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Puerto de embarque">
            <input
              maxLength={120}
              value={form.port_of_loading}
              onChange={(e) => set("port_of_loading")(e.target.value)}
              className="inp"
              placeholder="Antofagasta"
            />
          </Field>
          <Field label="Base de precio">
            <input
              maxLength={200}
              value={form.price_basis}
              onChange={(e) => set("price_basis")(e.target.value)}
              className="inp"
              placeholder="LME Cu M+1"
            />
          </Field>
          <Field label="Premium/Discount (USD/t)">
            <input
              type="number"
              step="any"
              value={form.premium_discount_usd_t}
              onChange={(e) => set("premium_discount_usd_t")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Precio fijo (USD, opcional)">
            <input
              type="number"
              min={0}
              step="any"
              value={form.asking_price_usd}
              onChange={(e) => set("asking_price_usd")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Términos de pago">
            <input
              maxLength={300}
              value={form.payment_terms}
              onChange={(e) => set("payment_terms")(e.target.value)}
              className="inp"
              placeholder="90% CAD, 10% al assay final"
            />
          </Field>
          <Field label="Resumen" className="sm:col-span-2 lg:col-span-3">
            <textarea
              maxLength={2000}
              rows={2}
              value={form.summary}
              onChange={(e) => set("summary")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Descripción completa" className="sm:col-span-2 lg:col-span-3">
            <textarea
              maxLength={8000}
              rows={4}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              className="inp"
              placeholder="Especificaciones, deleterios, logística, historial de producción…"
            />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded bg-teal text-black px-4 py-2 text-xs font-mono font-semibold hover:bg-teal/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Enviar a verificación
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border border-border px-4 py-2 text-xs font-mono hover:border-gold/40"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-border bg-bg-panel p-8 text-center text-sm text-muted-foreground">
          Aún no tienes lotes. Crea el primero con «Nuevo lote».
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => {
            const st = STATUS_META[r.status] ?? { label: r.status, cls: "border-border" };
            return (
              <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
                <header className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground leading-snug">{r.title}</h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${st.cls}`}
                  >
                    {st.label}
                  </span>
                </header>
                <div className="text-xs text-muted-foreground mb-2">
                  {commodityLabel(r.commodity)} · {formLabel(r.form)} ·{" "}
                  {[r.region, r.country].filter(Boolean).join(", ")}
                  {r.grade_pct != null && ` · ${r.grade_pct}%`}
                  {r.incoterm && ` · ${r.incoterm}`}
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>{formatTonnes(r.tonnage_available_t)} disponibles</span>
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {r.views_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {r.inquiry_count}
                    </span>
                  </span>
                </div>
                {r.status === "published" && (
                  <Link
                    to="/marketplace/$lotId"
                    params={{ lotId: r.id }}
                    className="mt-3 inline-block text-[11px] font-mono text-gold hover:underline"
                  >
                    Ver ficha pública →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .inp {
          width: 100%;
          border-radius: 4px;
          border: 1px solid hsl(var(--border));
          background: transparent;
          padding: 8px 10px;
          font-size: 13px;
          color: inherit;
        }
        .inp:focus { outline: 1px solid hsl(var(--ring, 45 70% 55%)); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
