import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileSignature,
  ShieldCheck,
  ShieldAlert,
  Download,
  Loader2,
  Ban,
  PenLine,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import { DocumentPreview } from "@/features/documents/DocumentEditor";
import {
  getSignRequest,
  submitSignature,
  verifyFlowSignatures,
} from "@/lib/documents/signing.functions";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";

// Página PÚBLICA de firma electrónica: la contraparte abre el link tokenizado,
// revisa el documento congelado, ve una vista previa de SU slot (parte,
// placeholder y sello) y firma. Sin cuenta.

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

function SignPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getSignRequest);
  const signFn = useServerFn(submitSignature);
  const verifyFn = useServerFn(verifyFlowSignatures);

  const { data: req, isLoading } = useQuery({
    queryKey: ["sign-request", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
  });

  // Verificación por firmante: recomputa el hash esperado de cada firma
  // completada y devuelve match/no match. Sólo tiene sentido cuando ya hay
  // al menos una firma en el flujo.
  const { data: verifications } = useQuery({
    queryKey: ["sign-verify", token],
    queryFn: () => verifyFn({ data: { token } }),
    enabled: Boolean(req && req.flowSignatures.length > 0),
    retry: false,
  });

  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Parte concreta (slot) del documento asignada a este firmante.
  const myParty = useMemo(() => {
    if (!req) return null;
    const sig = req.doc.blocks.find((b) => (b as { kind?: string }).kind === "signature") as
      { kind: "signature"; parties: string[] } | undefined;
    if (!sig) return null;
    const parties = sig.parties ?? [];
    return {
      parties,
      party: parties[req.signOrder] ?? null,
      totalParties: parties.length,
    };
  }, [req]);

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
      queryClient.invalidateQueries({ queryKey: ["sign-verify", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar.");
    } finally {
      setSigning(false);
    }
  };

  const [downloadingAudited, setDownloadingAudited] = useState(false);

  const buildStamps = () => {
    if (!req) return [];
    return req.flowSignatures.length > 0
      ? req.flowSignatures.map((s) => ({
          name: s.signedByName,
          signedAt: s.signedAt,
          hash: (s.signatureHash ?? "").slice(0, 12),
          partyIndex: s.order,
        }))
      : req.signedByName && req.signedAt
        ? [
            {
              name: req.signedByName,
              signedAt: req.signedAt,
              hash: (req.signatureHash ?? req.docHash ?? "").slice(0, 12),
              partyIndex: req.signOrder,
            },
          ]
        : [];
  };

  const downloadSigned = async () => {
    if (!req || req.status !== "signed") return;
    setDownloading(true);
    try {
      await renderGeocapitalsPdf(req.doc, { signatures: buildStamps() });
    } finally {
      setDownloading(false);
    }
  };

  const downloadAudited = async () => {
    if (!req || req.flowSignatures.length === 0) return;
    setDownloadingAudited(true);
    try {
      const audit = await buildAuditEntries();
      await renderGeocapitalsPdf(req.doc, {
        signatures: buildStamps(),
        signatureAudit: audit,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF auditado.");
    } finally {
      setDownloadingAudited(false);
    }
  };

  const buildAuditEntries = async () => {
    // Recomputa la validación al vuelo para que el PDF/preview refleje el
    // estado más reciente aunque el usuario tarde en apretar el botón.
    const fresh = await verifyFn({ data: { token } });
    return (fresh ?? []).map((v) => ({
      order: v.order,
      party: myParty?.parties[v.order],
      signerName: v.signedByName,
      match: v.hashMatch && v.orderMatch,
      hash: v.storedHash,
    }));
  };

  // Previsualización del PDF auditado (mismo binario que la descarga).
  // El blob se genera en cliente y se muestra en un iframe con object URL,
  // que se revoca al ocultar la vista o al desmontar la página.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const togglePreview = async () => {
    if (!req || req.flowSignatures.length === 0) return;
    if (previewOpen) {
      setPreviewOpen(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    setPreviewLoading(true);
    try {
      const audit = await buildAuditEntries();
      const blob = await renderGeocapitalsPdf(req.doc, {
        signatures: buildStamps(),
        signatureAudit: audit,
        returnBlob: true,
      });
      if (!(blob instanceof Blob)) throw new Error("preview");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const expired = req && req.status === "pending" && new Date(req.expiresAt) < new Date();

  return (
    <div
      data-theme="im-light"
      className="brand-light min-h-screen flex flex-col bg-surface text-content"
    >
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

            {/* Vista previa de la parte del firmante: le mostramos SU slot
                (placeholder, nombre esperado y sello previsto) antes de que
                acepte, para que confirme que está firmando la parte correcta. */}
            {myParty?.party && req.status === "pending" && !expired && (
              <div className="mb-6 rounded-xl border border-accent-brand/40 bg-accent-brand/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <PenLine className="w-4 h-4 text-accent-brand" />
                  <h2 className="text-sm font-semibold text-content">
                    Vista previa de tu firma · Parte {req.signOrder + 1} de {myParty.totalParties}
                  </h2>
                </div>
                <div className="rounded-lg border border-hairline bg-surface p-5">
                  {/* Simulación del slot que quedará impreso en el PDF final */}
                  <div className="min-h-[70px] flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <div
                        className="italic font-serif text-content text-lg leading-tight truncate"
                        aria-label="Vista previa de tu firma"
                      >
                        {name.trim() || (
                          <span className="text-content-subtle/60 not-italic text-sm">
                            Aquí aparecerá tu nombre como firma manuscrita
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 rounded border border-accent-brand/60 bg-surface px-2.5 py-1.5 text-center">
                      <div className="text-[9px] font-bold text-accent-brand tracking-wider">
                        {name.trim() ? "FIRMADO" : "PENDIENTE"}
                      </div>
                      <div className="text-[7px] text-content-subtle">Geocapitals</div>
                    </div>
                  </div>
                  <div className="border-t border-content mt-1 pt-2">
                    <div className="text-xs font-semibold text-content">{myParty.party}</div>
                    <div className="text-[10px] text-content-subtle mt-1">
                      {name.trim()
                        ? `Firmado electrónicamente por ${name.trim()}`
                        : req.signerNameExpected
                          ? `Firmante esperado: ${req.signerNameExpected}`
                          : "Nombre, cargo y firma"}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-content-subtle">
                  Tu firma quedará estampada exactamente en este slot del PDF. Las otras partes
                  firman en sus propios slots por separado.
                </p>
              </div>
            )}

            {/* Documento */}
            <div className="rounded-xl border border-hairline bg-surface-3 p-6 mb-6">
              <DocumentPreview doc={req.doc} />
            </div>

            {/* Validación de integridad por firmante (aparece cuando hay
                al menos una firma completada en el flujo). */}
            {req.flowSignatures.length > 0 && (
              <div className="mb-6 rounded-xl border border-hairline bg-surface-3 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-content" />
                  <h2 className="text-sm font-semibold text-content">
                    Validación de integridad por firmante
                  </h2>
                </div>
                <ul className="space-y-2">
                  {req.flowSignatures.map((s) => {
                    const v = verifications?.find((x) => x.order === s.order);
                    const ok = v ? v.hashMatch && v.orderMatch : null;
                    const partyLabel = myParty?.parties[s.order] ?? `Parte ${s.order + 1}`;
                    return (
                      <li
                        key={s.order}
                        className="rounded-lg border border-hairline bg-surface p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-content truncate">
                              {partyLabel}
                            </div>
                            <div className="text-[11px] text-content-subtle truncate">
                              {s.signedByName} · {new Date(s.signedAt).toLocaleString("es-CL")}
                            </div>
                            <div className="text-[10px] font-mono text-content-subtle break-all mt-1">
                              {s.signatureHash.slice(0, 24)}…
                            </div>
                          </div>
                          <div className="shrink-0">
                            {ok === null ? (
                              <Loader2 className="w-4 h-4 animate-spin text-content-subtle" />
                            ) : ok ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Coincide
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">
                                <XCircle className="w-3 h-3" /> No coincide
                              </span>
                            )}
                          </div>
                        </div>
                        {v && (!v.hashMatch || !v.orderMatch) && (
                          <div className="mt-2 flex items-start gap-1.5 rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 text-[10px] text-rose-700">
                            <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                              {!v.hashMatch &&
                                "El hash almacenado no coincide con el recalculado. "}
                              {!v.orderMatch &&
                                "El signOrder del firmante está fuera del rango de partes del documento."}
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[10px] text-content-subtle">
                  El hash de cada firmante se recalcula en el servidor a partir del documento
                  congelado, su nombre y el momento de la firma. Cualquier modificación posterior se
                  detecta aquí.
                </p>
              </div>
            )}

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
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void downloadSigned()}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-content text-surface px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Descargar PDF firmado
                  </button>
                  {req.flowSignatures.length > 0 && (
                    <>
                      <button
                        onClick={() => void togglePreview()}
                        disabled={previewLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface text-content px-4 py-2.5 text-sm font-medium hover:bg-surface-3 disabled:opacity-50"
                        title="Previsualiza el PDF con la banda de auditoría antes de descargarlo"
                      >
                        {previewLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : previewOpen ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        {previewOpen ? "Ocultar vista previa" : "Previsualizar PDF validado"}
                      </button>
                      <button
                        onClick={() => void downloadAudited()}
                        disabled={downloadingAudited}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent-brand text-accent-brand px-4 py-2.5 text-sm font-medium hover:bg-accent-brand/5 disabled:opacity-50"
                        title="Incluye una banda de auditoría con coincide/no coincide por firmante"
                      >
                        {downloadingAudited ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        Descargar PDF validado (auditoría)
                      </button>
                    </>
                  )}
                </div>
                {previewOpen && previewUrl && (
                  <div className="mt-4 rounded-lg border border-hairline bg-surface overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-surface-3">
                      <div className="text-[11px] text-content-subtle">
                        Vista previa del PDF validado (incluye banda de auditoría por firmante)
                      </div>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-accent-brand hover:underline"
                      >
                        Abrir en pestaña nueva
                      </a>
                    </div>
                    <iframe
                      src={previewUrl}
                      title="Vista previa PDF validado"
                      className="w-full h-[720px] bg-white"
                    />
                  </div>
                )}
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
