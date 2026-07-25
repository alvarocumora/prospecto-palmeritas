import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileSignature,
  ShieldCheck,
  Ban,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  Droplets,
} from "lucide-react";
import {
  fetchAndStamp,
  triggerBlobDownload,
  type SignerWatermark,
} from "@/lib/documents/watermark";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import {
  getOperationSignatureRequest,
  submitOperationSignature,
} from "@/lib/operations/signatures.functions";

// Página PÚBLICA de firma electrónica sobre una operación GeoCapitals.
// Cada firmante recibe su propio link `/firmar/operacion/$token`.
export const Route = createFileRoute("/firmar/operacion/$token")({
  head: () => ({
    meta: [
      { title: "Firma electrónica de operación — Geocapitals" },
      {
        name: "description",
        content:
          "Revisa y firma electrónicamente un documento congelado de una operación GeoCapitals.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignOperationPage,
});

function SignOperationPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getOperationSignatureRequest);
  const signFn = useServerFn(submitOperationSignature);

  const { data, isLoading, error } = useQuery({
    queryKey: ["op-sign-request", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  const onSign = async () => {
    if (name.trim().length < 3) return toast.error("Escribe tu nombre completo.");
    if (!accepted) return toast.error("Debes aceptar la declaración de firma.");
    setSigning(true);
    try {
      const res = await signFn({
        data: { token, signer_name: name.trim(), accepted: true },
      });
      toast.success(
        res.completed ? "Firma registrada · flujo completado" : "Firma registrada",
      );
      qc.invalidateQueries({ queryKey: ["op-sign-request", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar.");
    } finally {
      setSigning(false);
    }
  };

  const expired =
    data && data.envelope.status !== "completed" && data.envelope.expires_at
      ? new Date(data.envelope.expires_at) < new Date()
      : false;
  const alreadySigned = data?.signer.status === "signed";
  const envelopeClosed =
    data && (data.envelope.status === "completed" || data.envelope.status === "void");

  return (
    <div
      data-theme="im-light"
      className="brand-light min-h-screen flex flex-col bg-surface text-content"
    >
      <MarketingHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-10">
        {isLoading ? (
          <div className="h-40 rounded-xl border border-hairline bg-surface-3 animate-pulse" />
        ) : error || !data ? (
          <div className="text-center py-20">
            <Ban className="w-8 h-8 text-content-subtle mx-auto mb-3" />
            <h1 className="font-display text-2xl text-content">
              Enlace de firma inválido
            </h1>
            <p className="text-sm text-content-subtle mt-2">
              El enlace no existe, fue anulado o ha expirado. Pide uno nuevo a la
              contraparte.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <FileSignature className="w-5 h-5 text-accent-brand" />
              <h1 className="font-display text-2xl text-content">
                Firma electrónica de operación
              </h1>
            </div>
            <p className="text-xs text-content-subtle mb-6">
              {data.operation && (
                <>
                  <strong>{data.operation.code}</strong> · {data.operation.name} ·{" "}
                  {data.operation.commodity}
                  {" · "}
                </>
              )}
              Documento congelado{" "}
              <code className="font-mono">{data.envelope.hash.slice(0, 20)}…</code>
            </p>

            {/* Info del firmante */}
            <div className="mb-5 rounded-xl border border-accent-brand/40 bg-accent-brand/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent-brand">
                Firmante {data.signer.order} de {data.envelope.required}
              </div>
              <div className="mt-1 text-sm text-content">
                <strong>{data.signer.name}</strong> · rol {data.signer.role}
              </div>
              <div className="text-[11px] text-content-subtle mt-1">
                {data.envelope.title}
              </div>
            </div>

            {/* Panel de firmantes */}
            <div className="mb-6 rounded-xl border border-hairline bg-surface-3 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-content-subtle mb-2">
                Estado de firmas
              </div>
              <ul className="space-y-1.5">
                {data.signers.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">
                      <span className="text-content-subtle text-xs mr-2">
                        #{s.signing_order}
                      </span>
                      <strong>{s.signer_name}</strong>{" "}
                      <span className="text-content-subtle text-xs">
                        · {s.signer_role}
                      </span>
                    </span>
                    {s.status === "signed" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                        {s.signed_at &&
                          new Date(s.signed_at).toLocaleDateString("es-CL")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-content-subtle text-xs">
                        <Clock className="w-3.5 h-3.5" /> pendiente
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* PDF del documento congelado */}
            {data.pdf_url && (
              <div className="mb-6 rounded-xl border border-hairline overflow-hidden bg-surface-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-hairline">
                  <div className="text-xs font-semibold text-content">
                    Documento a firmar (versión inmutable)
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={data.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent-brand hover:underline"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={data.pdf_url}
                      download={`${data.envelope.title || "documento"}-congelado.pdf`}
                      className="inline-flex items-center gap-1 text-xs text-accent-brand hover:underline"
                    >
                      <Download className="w-3 h-3" /> Versión congelada
                    </a>
                    {data.signed_pdf_url && (
                      <a
                        href={data.signed_pdf_url}
                        download={`${data.envelope.title || "documento"}-firmado.pdf`}
                        className="inline-flex items-center gap-1 rounded-md bg-content text-surface px-2.5 py-1 text-xs font-medium hover:opacity-90"
                      >
                        <Download className="w-3 h-3" /> PDF firmado
                      </a>
                    )}
                  </div>
                </div>
                <iframe
                  src={data.pdf_url}
                  className="w-full h-[600px] bg-surface"
                  title="Documento a firmar"
                />
              </div>
            )}

            {/* Acción */}
            {alreadySigned ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-5 h-5" /> Firma registrada
                </div>
                <div className="mt-1 text-sm text-content">
                  Firmaste el {" "}
                  {data.signer.signed_at &&
                    new Date(data.signer.signed_at).toLocaleString("es-CL")}
                  .
                </div>
              </div>
            ) : envelopeClosed ? (
              <div className="rounded-xl border border-hairline bg-surface-3 p-5 text-sm text-content-subtle">
                Este flujo de firma ya está cerrado.
              </div>
            ) : expired ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-800">
                El enlace ha expirado. Solicita uno nuevo a GeoCapitals.
              </div>
            ) : (
              <div className="rounded-xl border border-hairline bg-surface-3 p-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-content-subtle">
                  Tu nombre completo (aparecerá como firma)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={data.signer.name}
                  className="mt-2 w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm"
                  autoComplete="name"
                />
                <label className="mt-4 flex items-start gap-2 text-xs text-content-subtle">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Declaro que soy quien firma y acepto que este acto constituye
                    firma electrónica simple con validez legal, vinculada al hash
                    SHA-256 del documento congelado mostrado arriba.
                  </span>
                </label>
                <button
                  onClick={() => void onSign()}
                  disabled={signing || !accepted || name.trim().length < 3}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-content text-surface px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {signing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSignature className="w-4 h-4" />
                  )}
                  Firmar electrónicamente
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
