import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createPropertyListing,
  listMyListings,
  type CreateListingInput,
  type MyListingRow,
} from "@/lib/myListings.functions";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { fmtUSD } from "@/modules/deals/domain/format";

export const Route = createFileRoute("/_authenticated/dashboard/listings")({
  head: () => ({ meta: [{ title: "Mis listings — Geocapitals" }] }),
  component: MyListingsPage,
});

const MODALITIES = ["sale", "jv", "royalty", "option"] as const;
const STAGES = [
  "greenfield",
  "brownfield",
  "scoping",
  "prefeasibility",
  "feasibility",
  "production",
] as const;

const EMPTY_FORM = {
  title: "",
  commodity: "",
  country: "Chile",
  region: "",
  modality: "sale" as (typeof MODALITIES)[number],
  stage: "greenfield" as (typeof STAGES)[number],
  area_ha: "",
  asking_price_usd: "",
  royalty_pct: "",
  summary: "",
};

function MyListingsPage() {
  const [rows, setRows] = useState<MyListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listMyListings());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CreateListingInput = {
        title: form.title,
        commodity: form.commodity,
        country: form.country,
        region: form.region || null,
        modality: form.modality,
        stage: form.stage,
        area_ha: form.area_ha ? Number(form.area_ha) : null,
        asking_price_usd: form.asking_price_usd ? Number(form.asking_price_usd) : null,
        royalty_pct: form.royalty_pct ? Number(form.royalty_pct) : null,
        summary: form.summary || null,
      };
      await createPropertyListing({ data: payload });
      toast.success("Listing creado como borrador. El equipo lo revisará antes de publicar.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el listing");
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
          <h1 className="text-xl md:text-2xl font-bold mt-1">Mis listings</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Crea el perfil de tu deal. Queda en borrador hasta que el equipo lo verifique y publique
            en el deal flow público.
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
            <Plus className="w-3.5 h-3.5" /> Nuevo listing
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded border border-border bg-bg-panel p-4 mb-6 grid sm:grid-cols-2 gap-3"
        >
          <Field label="Título del proyecto *" className="sm:col-span-2">
            <input
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              className="inp"
              placeholder="Prospecto Cerro Ejemplo"
            />
          </Field>
          <Field label="Commodity *">
            <input
              required
              maxLength={40}
              value={form.commodity}
              onChange={(e) => set("commodity")(e.target.value)}
              className="inp"
              placeholder="Au-Ag, Cu, Li…"
            />
          </Field>
          <Field label="País *">
            <input
              required
              maxLength={80}
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
              className="inp"
            />
          </Field>
          <Field label="Región">
            <input
              maxLength={120}
              value={form.region}
              onChange={(e) => set("region")(e.target.value)}
              className="inp"
              placeholder="Coquimbo"
            />
          </Field>
          <Field label="Modalidad *">
            <select
              value={form.modality}
              onChange={(e) => set("modality")(e.target.value)}
              className="inp"
            >
              {MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {MODALITY_LABEL[m] ?? m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Etapa *">
            <select
              value={form.stage}
              onChange={(e) => set("stage")(e.target.value)}
              className="inp"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Superficie (ha)">
            <input
              type="number"
              min={0}
              step="any"
              value={form.area_ha}
              onChange={(e) => set("area_ha")(e.target.value)}
              className="inp"
            />
          </Field>
          {form.modality === "royalty" ? (
            <Field label="Royalty (% NSR)">
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.royalty_pct}
                onChange={(e) => set("royalty_pct")(e.target.value)}
                className="inp"
              />
            </Field>
          ) : (
            <Field label="Precio pedido (USD)">
              <input
                type="number"
                min={0}
                step="any"
                value={form.asking_price_usd}
                onChange={(e) => set("asking_price_usd")(e.target.value)}
                className="inp"
              />
            </Field>
          )}
          <Field label="Resumen" className="sm:col-span-2">
            <textarea
              maxLength={4000}
              rows={3}
              value={form.summary}
              onChange={(e) => set("summary")(e.target.value)}
              className="inp"
              placeholder="Descripción técnica y comercial del proyecto…"
            />
          </Field>
          <div className="sm:col-span-2 flex gap-2">
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
              Crear borrador
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
          Aún no tienes listings. Crea el primero con «Nuevo listing».
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
              <header className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground leading-snug">{r.title}</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                    r.is_published
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-warn/40 bg-warn/10 text-warn"
                  }`}
                >
                  {r.is_published ? "Publicado" : "Borrador"}
                </span>
              </header>
              <div className="text-xs text-muted-foreground mb-2">
                {r.commodity} · {[r.region, r.country].filter(Boolean).join(", ")} ·{" "}
                {STAGE_LABEL[r.stage] ?? r.stage} · {MODALITY_LABEL[r.modality] ?? r.modality}
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-foreground font-semibold">
                  {r.modality === "royalty" && r.royalty_pct != null
                    ? `${r.royalty_pct}% NSR`
                    : fmtUSD(r.asking_price_usd)}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Eye className="w-3 h-3" /> {r.views_count}
                </span>
              </div>
              {r.is_published && (
                <Link
                  to="/proyectos/$listingId"
                  params={{ listingId: r.id }}
                  className="mt-3 inline-block text-[11px] font-mono text-gold hover:underline"
                >
                  Ver ficha pública →
                </Link>
              )}
            </article>
          ))}
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
