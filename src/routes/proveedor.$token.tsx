import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PackageSearch, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import { getSourcingRequestByToken, submitSourcingProposal } from "@/lib/sourcing.functions";

// Página PÚBLICA: un asociado/proveedor abre el link tokenizado, ve qué se
// busca y sube su propuesta con documentos. Sin cuenta.

export const Route = createFileRoute("/proveedor/$token")({
  head: () => ({
    meta: [
      { title: "Subir propuesta de proveedor — Geocapitals" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProveedorPage,
});

const EMPTY = {
  supplierName: "",
  supplierCompany: "",
  supplierCountry: "",
  contactEmail: "",
  contactPhone: "",
  offerPriceUsdT: "",
  offerQuantityT: "",
  incoterm: "",
  leadTime: "",
  specs: "",
  notes: "",
};

function ProveedorPage() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getSourcingRequestByToken);
  const submitFn = useServerFn(submitSourcingProposal);

  const { data: req, isLoading } = useQuery({
    queryKey: ["sourcing-public", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  const [form, setForm] = useState(EMPTY);
  const [docs, setDocs] = useState<Array<{ label: string; url: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const addDoc = () => setDocs((d) => [...d, { label: "", url: "" }]);
  const setDoc = (i: number, k: "label" | "url", v: string) =>
    setDocs((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const removeDoc = (i: number) => setDocs((d) => d.filter((_, j) => j !== i));

  const onSubmit = async () => {
    if (form.supplierName.trim().length < 2) {
      toast.error("Ingresa tu nombre o el de tu empresa.");
      return;
    }
    setSubmitting(true);
    try {
      await submitFn({
        data: {
          token,
          supplierName: form.supplierName,
          supplierCompany: form.supplierCompany || undefined,
          supplierCountry: form.supplierCountry || undefined,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          offerPriceUsdT: form.offerPriceUsdT ? Number(form.offerPriceUsdT) : undefined,
          offerQuantityT: form.offerQuantityT ? Number(form.offerQuantityT) : undefined,
          incoterm: form.incoterm || undefined,
          leadTime: form.leadTime || undefined,
          specs: form.specs || undefined,
          notes: form.notes || undefined,
          documents: docs
            .filter((d) => d.label.trim() && d.url.trim())
            .map((d) => ({ label: d.label.trim(), url: d.url.trim() })),
        },
      });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la propuesta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="brand-light min-h-screen flex flex-col bg-surface">
      <MarketingHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
        {isLoading ? (
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        ) : !req ? (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <h1 className="font-display text-2xl text-content mb-2">Link inválido</h1>
            <p className="text-sm text-content-subtle">
              Este enlace no corresponde a un requerimiento activo. Pídele al comprador un link
              nuevo.
            </p>
          </div>
        ) : done ? (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <h1 className="font-display text-2xl text-content mb-2">Propuesta enviada</h1>
            <p className="text-sm text-content-subtle">
              Gracias. El comprador revisará tu propuesta para <strong>{req.reference}</strong> y te
              contactará si avanza.
            </p>
          </div>
        ) : req.status !== "abierto" || req.expired ? (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <h1 className="font-display text-2xl text-content mb-2">Requerimiento cerrado</h1>
            <p className="text-sm text-content-subtle">
              Este requerimiento ya no recibe propuestas.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-brand mb-2">
              <PackageSearch className="w-4 h-4" /> Requerimiento de compra
            </div>
            <h1 className="font-display text-2xl lg:text-3xl text-content">{req.reference}</h1>
            <div className="mt-2 rounded-xl border border-hairline bg-white p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Commodity" value={req.commodity} />
                <Field label="Forma" value={req.form} />
                <Field
                  label="Cantidad"
                  value={req.quantityT != null ? `${req.quantityT} t` : null}
                />
                <Field label="Incoterm" value={req.incoterm} />
                <Field label="Destino" value={req.destination} />
              </div>
              {req.specs && (
                <p className="mt-2 pt-2 border-t border-hairline text-content-subtle text-[13px]">
                  {req.specs}
                </p>
              )}
            </div>

            <h2 className="font-display text-lg text-content mt-6 mb-3">Tu propuesta</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ["supplierName", "Nombre / contacto *"],
                  ["supplierCompany", "Empresa"],
                  ["supplierCountry", "País"],
                  ["contactEmail", "Email"],
                  ["contactPhone", "Teléfono / WhatsApp"],
                  ["offerPriceUsdT", "Precio ofertado US$/t"],
                  ["offerQuantityT", "Cantidad disponible (t)"],
                  ["incoterm", "Incoterm"],
                  ["leadTime", "Plazo de entrega"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="text-xs">
                  <span className="block text-content-subtle mb-1">{label}</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-hairline bg-white text-sm"
                  />
                </label>
              ))}
            </div>
            <label className="text-xs block mt-3">
              <span className="block text-content-subtle mb-1">
                Especificaciones de tu material
              </span>
              <textarea
                value={form.specs}
                rows={2}
                onChange={(e) => setForm({ ...form, specs: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-hairline bg-white text-sm"
              />
            </label>
            <label className="text-xs block mt-3">
              <span className="block text-content-subtle mb-1">
                Notas / condiciones comerciales
              </span>
              <textarea
                value={form.notes}
                rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-hairline bg-white text-sm"
              />
            </label>

            {/* Documentos (links) */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-content-subtle">
                  Documentos (assay, certificados, propuesta) — pega el link
                </span>
                <button
                  onClick={addDoc}
                  className="text-[11px] font-mono text-accent-brand hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              {docs.map((d, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={d.label}
                    placeholder="Etiqueta (ej. Assay CIMM)"
                    onChange={(e) => setDoc(i, "label", e.target.value)}
                    className="w-1/3 px-3 py-2 rounded-lg border border-hairline bg-white text-sm"
                  />
                  <input
                    value={d.url}
                    placeholder="https://…"
                    onChange={(e) => setDoc(i, "url", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-hairline bg-white text-sm"
                  />
                  <button
                    onClick={() => removeDoc(i)}
                    className="shrink-0 p-2 rounded-lg border border-hairline hover:bg-slate-50"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => void onSubmit()}
              disabled={submitting}
              className="mt-5 w-full rounded-lg bg-accent-brand text-white py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar propuesta
            </button>
            <p className="mt-2 text-[11px] text-content-subtle text-center">
              Tu propuesta se comparte solo con el comprador de este requerimiento.
            </p>
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </div>
      <div className="text-content">{value ?? "—"}</div>
    </div>
  );
}
