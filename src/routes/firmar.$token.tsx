import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, ShieldCheck, Download, Loader2, Ban } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import { DocumentPreview } from "@/features/documents/DocumentEditor";
import { getSignRequest, submitSignature } from "@/lib/documents/signing.functions";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";
import type { GeneratedDoc } from "@/lib/documents/model";

// Página PÚBLICA de firma electrónica: la contraparte abre el link tokenizado,
// revisa el documento congelado y firma con su nombre + declaración. Sin cuenta.

export const Route = createFileRoute("/firmar/$token")({
  head: () => ({
    meta: [
      { title: "Firma electrónica de documento — Geocapitals" },
      {
        name: "description",
        content: "Revisa y firma electrónicamente un documento emitido vía Geocapitals.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignPage,
});

// Cuenta las parties del bloque de firma para saber a qué slot corresponde el
// firmante remoto (la contraparte suele ser la última party listada).
function counterpartyIndex(doc: GeneratedDoc): number {
  for (const b of doc.blocks) {
    if (b.kind === "signature") return Math.max(0, b.parties.length - 1);
  }
  return 0;
}


function SignPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getSignRequest);
  const signFn = useServerFn(submitSignature);

  const { data: req, isLoading } = useQuery({
    queryKey: ["sign-request", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const onSign = async () => {
    if (name.trim().length < 3) {
      toast.error("Escribe tu nombre completo.");
      return;
    }
    if (!accepted) {
      toast.error("Debes aceptar la declaración de firma.");
      return;
    }
    setSigning(true);
    try {
      await signFn({ data: { token, signerName: name.trim(), accepted: true } });
      toast.success("Documento firmado.");
      queryClient.invalidateQueries({ queryKey: ["sign-request", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar.");
    } finally {
      setSigning(false);
    }
  };

  const downloadSigned = async () => {
    if (!req || req.status !== "signed" || !req.signedByName || !req.signedAt) return;
    setDownloading(true);
    try {
      await renderGeocapitalsPdf(req.doc, {
        signatures: [
          {
            name: req.signedByName,
            signedAt: req.signedAt,
            hash: (req.signatureHash ?? req.docHash ?? "").slice(0, 12),
            partyIndex: counterpartyIndex(req.doc),
          },
        ],
      });

    } finally {
      setDownloading(false);
    }
  };

  const expired = req && req.status === "pending" && new Date(req.expiresAt) < new Date();

  return (
    <div data-theme="im-light" className="brand-light min-h-screen flex flex-col bg-surface text-content">
      <MarketingHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-10">
        {isLoading ? (
          <div className="h-40 rounded-xl border border-hairline bg-surface-3 animate-pulse" />
        ) : !req ? (
          <div className="text-center py-20">
            <Ban className="w-8 h-8 text-content-subtle mx-auto mb-3" />
            <h1 className="font-display text-2xl text-content">Link de firma inválido</h1>
            <p className="text-sm text-content-subtle mt-2">
              El link no existe, fue anulado o es incorrecto. Pide a tu contraparte uno nuevo.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <FileSignature className="w-5 h-5 text-accent-brand" />
              <h1 className="font-display text-2xl text-content">Firma electrónica</h1>
            </div>
            <p className="text-xs text-content-subtle mb-6">
              Ref {req.reference} · Documento congelado con hash{" "}
              <code className="font-mono">{req.docHash.slice(0, 16)}…</code>
            </p>

            {/* Documento */}
             <div className="rounded-xl border border-hairline bg-surface-3 p-6 mb-6">
              <DocumentPreview doc={req.doc} />
            </div>

            {/* Estado / acción */}
            {req.status === "signed" ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-5 h-5" /> Documento firmado
                </div>
                <div className="mt-2 text-sm text-content">
                  Por <strong>{req.signedByName}</strong> ·{" "}
                  {req.signedAt && new Date(req.signedAt).toLocaleString("es-CL")}
                </div>
                <div className="mt-1 text-[11px] font-mono text-content-subtle break-all">
                  Firma: {req.signatureHash}
                </div>
                <button
                  onClick={() => void downloadSigned()}
                  disabled={downloading}
                   className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-content text-surface px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Descargar PDF firmado
                </button>
              </div>
            ) : req.status === "void" ? (
              <div className="rounded-xl border border-hairline bg-slate-50 p-5 text-sm text-content-subtle">
                Esta solicitud de firma fue anulada por el emisor.
              </div>
            ) : expired ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-700">
                El link de firma expiró. Pide a tu contraparte que genere uno nuevo.
              </div>
            ) : (
               <div className="rounded-xl border border-hairline bg-surface-3 p-5">
                <h2 className="text-sm font-semibold text-content mb-3">
                  Firmar como{req.signerNameExpected ? ` (${req.signerNameExpected})` : ""}
                </h2>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre completo del firmante"
                  className="w-full rounded-lg border border-hairline px-3 py-2.5 text-sm text-content focus:outline-none focus:ring-1 focus:ring-accent-brand"
                />
                <label className="mt-3 flex items-start gap-2 text-xs text-content-subtle">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  Declaro que he leído el documento, que estoy facultado para suscribirlo y que esta
                  firma electrónica manifiesta mi consentimiento con su contenido.
                </label>
                <button
                  onClick={() => void onSign()}
                  disabled={signing}
                   className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-brand text-accent-brand-contrast px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {signing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSignature className="w-4 h-4" />
                  )}
                  Firmar documento
                </button>
              </div>
            )}

            <p className="mt-6 text-[10px] text-content-subtle leading-relaxed">
              La firma queda registrada con sello de tiempo y hash de integridad que liga el
              documento, el firmante y el momento de la firma. Geocapitals no modifica el documento
              después de emitido el link.
            </p>
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
