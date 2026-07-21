import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PackageSearch, Mail, Phone, FileText, ExternalLink, ShieldCheck, Download, Loader2 } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import {
  getSupplierSheetByShareToken,
  getSupplierFileUrlByShareToken,
} from "@/lib/sourcing.functions";
import { SUPPLIER_ROLE_LABELS, normalizeSupplierRole, isOfferExpired } from "@/lib/sourcing";
import { downloadSupplierSheetPdf } from "@/lib/supplierSheetPdf";

// Página PÚBLICA de solo lectura: la FICHA DE PROVEEDOR que el comprador/gestor
// comparte con el comprador final. Un token distinto al de submit.

export const Route = createFileRoute("/ficha-proveedor/$token")({
  head: () => ({
    meta: [{ title: "Ficha de proveedor — Geocapitals" }, { name: "robots", content: "noindex" }],
  }),
  component: SupplierSheetPage,
});

const fmtUsdT = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}/t` : "—";

function SupplierSheetPage() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getSupplierSheetByShareToken);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-sheet", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  return (
    <div className="brand-light min-h-screen flex flex-col bg-surface">
      <MarketingHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
        {isLoading ? (
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        ) : !data ? (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <h1 className="font-display text-2xl text-content mb-2">Ficha no disponible</h1>
            <p className="text-sm text-content-subtle">
              Este enlace no corresponde a una ficha de proveedor activa.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-brand mb-2">
              <PackageSearch className="w-4 h-4" /> Ficha de proveedor
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl lg:text-3xl text-content">
                {data.supplier.supplier_name}
              </h1>
              {data.supplier.supplier_role && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-brand/10 text-accent-brand">
                  {SUPPLIER_ROLE_LABELS[
                    normalizeSupplierRole(data.supplier.supplier_role) ?? "otro"
                  ] ?? data.supplier.supplier_role}
                </span>
              )}
            </div>
            <div className="text-sm text-content-subtle">
              {[data.supplier.supplier_company, data.supplier.supplier_country]
                .filter(Boolean)
                .join(" · ") || ""}
            </div>

            <div className="mt-3">
              <DownloadSheetButton sheet={data} />
            </div>

            {data.supplier.offer_valid_until &&
              isOfferExpired(data.supplier.offer_valid_until, new Date()) && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  Esta oferta expiró el {data.supplier.offer_valid_until}. Solicita al proveedor una
                  actualización de precio y disponibilidad.
                </div>
              )}

            {/* Requerimiento de referencia */}
            <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
                Requerimiento · {data.request.reference}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Field label="Commodity" value={data.request.commodity} />
                <Field label="Forma" value={data.request.form} />
                <Field
                  label="Cantidad"
                  value={data.request.quantityT != null ? `${data.request.quantityT} t` : null}
                />
                <Field label="Incoterm" value={data.request.incoterm} />
                <Field label="Destino" value={data.request.destination} />
              </div>
            </div>

            {/* Oferta del proveedor */}
            <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
                Oferta
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Field label="Precio" value={fmtUsdT(data.supplier.offer_price_usd_t)} />
                <Field
                  label="Cantidad"
                  value={
                    data.supplier.offer_quantity_t != null
                      ? `${data.supplier.offer_quantity_t} t`
                      : null
                  }
                />
                <Field label="Incoterm" value={data.supplier.incoterm} />
                <Field label="Puerto de carga" value={data.supplier.port_loading} />
                <Field label="Plazo" value={data.supplier.lead_time} />
                <Field label="Modo de pago" value={data.supplier.payment_terms} />
                <Field label="Calidad / ley" value={data.supplier.quality_grade} />
                <Field label="Empaque" value={data.supplier.packaging} />
                <Field label="Válida hasta" value={data.supplier.offer_valid_until} />
              </div>
              {data.supplier.specs && (
                <p className="mt-2 pt-2 border-t border-hairline text-[13px] text-content-subtle">
                  {data.supplier.specs}
                </p>
              )}
              {data.supplier.notes && (
                <p className="mt-1 text-[13px] text-content-subtle">{data.supplier.notes}</p>
              )}
            </div>

            {/* Contacto */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {data.supplier.contact_email && (
                <a
                  href={`mailto:${data.supplier.contact_email}`}
                  className="inline-flex items-center gap-1.5 text-accent-brand hover:underline"
                >
                  <Mail className="w-4 h-4" /> {data.supplier.contact_email}
                </a>
              )}
              {data.supplier.contact_phone && (
                <span className="inline-flex items-center gap-1.5 text-content-subtle">
                  <Phone className="w-4 h-4" /> {data.supplier.contact_phone}
                </span>
              )}
            </div>

            {/* Documentos */}
            {data.supplier.documents.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
                  Documentos aportados
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.supplier.documents.map((d, i) => (
                    <SheetDocChip key={i} token={token} doc={d} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2 text-[11px] font-mono text-content-subtle">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
              Ficha compartida vía Geocapitals · información provista por el proveedor.
            </div>
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}

function SheetDocChip({
  token,
  doc,
}: {
  token: string;
  doc: { label: string; url?: string | null; path?: string | null };
}) {
  const fileFn = useServerFn(getSupplierFileUrlByShareToken);
  const [busy, setBusy] = useState(false);
  const cls =
    "inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-lg border border-hairline bg-white hover:border-accent-brand disabled:opacity-50";
  if (doc.url) {
    return (
      <a href={doc.url} target="_blank" rel="noopener noreferrer" className={cls}>
        <FileText className="w-3.5 h-3.5" /> {doc.label} <ExternalLink className="w-3 h-3" />
      </a>
    );
  }
  const open = async () => {
    if (!doc.path) return;
    setBusy(true);
    try {
      const res = await fileFn({ data: { token, path: doc.path } });
      if (res?.url) window.open(res.url, "_blank", "noopener");
      else toast.error("No se pudo abrir el archivo.");
    } catch {
      toast.error("No se pudo abrir el archivo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={() => void open()} disabled={busy} className={cls}>
      <FileText className="w-3.5 h-3.5" /> {doc.label} <ExternalLink className="w-3 h-3" />
    </button>
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

function DownloadSheetButton({ sheet }: { sheet: import("@/lib/sourcing.functions").SupplierSheet }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await downloadSupplierSheetPdf(sheet);
      toast.success("PDF descargado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={() => void onClick()}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {busy ? "Generando PDF…" : "Descargar ficha en PDF"}
    </button>
  );
}
