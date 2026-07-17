import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PackageSearch, Plus, ArrowRight, Copy, AlertTriangle, Link2 } from "lucide-react";
import { createSourcingRequest, listSourcingRequests } from "@/lib/sourcing.functions";
import { sourcingSubmitUrl } from "@/lib/publicUrl";

// Requerimientos de commodities: registra qué buscas y comparte un link para
// que asociados/proveedores suban su propuesta. Cada requerimiento agrega el
// n.º de propuestas, preseleccionadas y el mejor precio recibido.

export const Route = createFileRoute("/_authenticated/dashboard/sourcing")({
  head: () => ({ meta: [{ title: "Requerimientos de commodities — Geocapitals" }] }),
  component: SourcingPage,
});

const EMPTY = {
  reference: "",
  commodity: "",
  form: "",
  quantityT: "",
  incoterm: "",
  destination: "",
  targetPriceUsdT: "",
  specs: "",
  notes: "",
};

function SourcingPage() {
  const createFn = useServerFn(createSourcingRequest);
  const listFn = useServerFn(listSourcingRequests);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sourcing-requests"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const onCreate = async () => {
    if (!form.reference.trim() || !form.commodity.trim()) {
      toast.error("Referencia y commodity son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const { submitToken } = await createFn({
        data: {
          reference: form.reference,
          commodity: form.commodity,
          form: form.form || undefined,
          quantityT: form.quantityT ? Number(form.quantityT) : undefined,
          incoterm: form.incoterm || undefined,
          destination: form.destination || undefined,
          targetPriceUsdT: form.targetPriceUsdT ? Number(form.targetPriceUsdT) : undefined,
          specs: form.specs || undefined,
          notes: form.notes || undefined,
        },
      });
      const url = sourcingSubmitUrl(submitToken);
      setLastLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Requerimiento creado. Link para proveedores copiado.");
      setForm(EMPTY);
      setShowForm(false);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  };

  const requests = data?.requests ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Requerimientos de commodities</h1>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Registra qué buscas y comparte un link para que asociados y proveedores suban su
            propuesta con documentos. Luego generas la ficha de proveedor y la compartes con el
            comprador.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nuevo requerimiento
        </button>
      </div>

      {data?.pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          El sourcing se activa al aplicar la migración{" "}
          <code className="font-mono">20260719160000_sourcing.sql</code> (pídesela a Lovable).
        </div>
      )}

      {lastLink && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-[11px] font-medium text-amber-700 mb-1">
            Link para proveedores (compártelo — vuelve a estar en cada requerimiento):
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono break-all flex-1">{lastLink}</code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(lastLink);
                toast.success("Copiado");
              }}
              className="shrink-0 p-1.5 rounded border border-border hover:bg-accent"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-md border border-border bg-bg-secondary/20 p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(
            [
              ["reference", "Referencia *", "RFQ-COBRE-01"],
              ["commodity", "Commodity *", "Concentrado de cobre"],
              ["form", "Forma", "Concentrado / cátodo…"],
              ["quantityT", "Cantidad (t)", "5000"],
              ["incoterm", "Incoterm", "CIF"],
              ["destination", "Destino", "Shanghai"],
              ["targetPriceUsdT", "Precio objetivo US$/t", "8500"],
            ] as const
          ).map(([k, label, ph]) => (
            <label key={k} className="text-xs">
              <span className="block text-text-secondary mb-1">{label}</span>
              <input
                value={form[k]}
                placeholder={ph}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
              />
            </label>
          ))}
          <label className="text-xs sm:col-span-2 lg:col-span-3">
            <span className="block text-text-secondary mb-1">Especificaciones</span>
            <textarea
              value={form.specs}
              rows={2}
              placeholder="Ley mínima, humedad, elementos penalizables, certificaciones requeridas…"
              onChange={(e) => setForm({ ...form, specs: e.target.value })}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
            />
          </label>
          <div>
            <button
              onClick={() => void onCreate()}
              disabled={saving}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
            >
              {saving ? "Creando…" : "Crear y generar link"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-32 rounded bg-muted/20 animate-pulse" />
      ) : requests.length === 0 && !data?.pending ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
          Aún no tienes requerimientos. Crea el primero y comparte el link con tus proveedores para
          recibir propuestas.
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Link
              key={r.id}
              to="/dashboard/sourcing/$requestId"
              params={{ requestId: r.id }}
              className="rounded-md border border-border bg-bg-secondary/20 p-4 hover:border-primary/50 transition-colors block"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{r.reference}</span>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        r.status === "abierto"
                          ? "bg-green-500/15 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {r.commodity}
                    {r.quantity_t ? ` · ${r.quantity_t} t` : ""}
                    {r.incoterm ? ` · ${r.incoterm}` : ""}
                    {r.destination ? ` · ${r.destination}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold">{r.summary.total}</div>
                    <div className="text-[9px] uppercase text-muted-foreground">propuestas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-primary">
                      {r.summary.shortlisted}
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">preselec.</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold">
                      {r.summary.bestPriceUsdT != null
                        ? `$${Math.round(r.summary.bestPriceUsdT).toLocaleString("es-CL")}`
                        : "—"}
                    </div>
                    <div className="text-[9px] uppercase text-muted-foreground">mejor US$/t</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <Link2 className="w-3 h-3" /> {r.submit_token_prefix}…
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
