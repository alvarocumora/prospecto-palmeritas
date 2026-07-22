import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { X, Copy, Check, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import {
  createSignFlow,
  createSignRequest,
} from "@/lib/documents/signing.functions";
import { signUrl } from "@/lib/publicUrl";
import {
  SPECIAL_DOCS,
  type SpecialDocId,
  type SpecialDocSigner,
} from "@/lib/documents/specialDocs";

type Props = {
  docId: SpecialDocId;
  onClose: () => void;
};

type IssuedLink = { role: string; url: string; email?: string };

export function SpecialDocSignDialog({ docId, onClose }: Props) {
  const doc = SPECIAL_DOCS.find((d) => d.id === docId);
  const createFlow = useServerFn(createSignFlow);
  const createOne = useServerFn(createSignRequest);
  const [signers, setSigners] = useState<SpecialDocSigner[]>(doc?.signers ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<IssuedLink[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!doc) return null;

  const update = (i: number, patch: Partial<SpecialDocSigner>) => {
    setSigners((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const onSubmit = async () => {
    const cleaned = signers
      .map((s) => ({
        role: s.role.trim(),
        name: s.name?.trim() || undefined,
        email: s.email?.trim() || undefined,
      }))
      .filter((s) => s.role.length > 0);
    if (cleaned.length === 0) {
      toast.error("Debes indicar al menos un firmante.");
      return;
    }
    setSubmitting(true);
    try {
      const generated = doc.build();
      if (cleaned.length === 1) {
        const s = cleaned[0];
        const res = await createOne({
          data: {
            templateId: `special:${doc.id}`,
            doc: generated,
            signerName: s.name,
            signerEmail: s.email,
          },
        });
        setIssued([{ role: s.role, url: signUrl(res.token), email: s.email }]);
      } else {
        const res = await createFlow({
          data: {
            templateId: `special:${doc.id}`,
            doc: generated,
            signers: cleaned,
          },
        });
        const links = res.tokens.map((t) => ({
          role: cleaned[t.order].role,
          email: cleaned[t.order].email,
          url: signUrl(t.token),
        }));
        setIssued(links);
      }
      toast.success("Solicitud de firma creada. Copia y comparte los enlaces.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-hairline shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-brand">
              Firma electrónica · {doc.acronym}
            </div>
            <h2 className="font-display text-xl text-content mt-0.5">{doc.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-surface-3 text-content-subtle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!issued ? (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-content-subtle">
              Configura los firmantes. Cada uno recibirá su propio enlace único bajo{" "}
              <span className="font-mono">/firmar/…</span>. El estado (pendiente, firmado,
              vencido) queda en <span className="font-mono">/dashboard/firmas</span>.
            </p>

            <div className="space-y-3">
              {signers.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-hairline bg-surface-2 p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-brand text-white text-[11px] font-mono">
                      {i + 1}
                    </span>
                    <input
                      value={s.role}
                      onChange={(e) => update(i, { role: e.target.value })}
                      placeholder="Rol o parte firmante"
                      className="flex-1 bg-transparent border-b border-hairline text-sm font-medium text-content focus:border-accent-brand outline-none py-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                    <input
                      value={s.name ?? ""}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="Nombre del firmante"
                      className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-content focus:border-accent-brand outline-none"
                    />
                    <input
                      type="email"
                      value={s.email ?? ""}
                      onChange={(e) => update(i, { email: e.target.value })}
                      placeholder="Email (para notificarle el link)"
                      className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-content focus:border-accent-brand outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSigners((prev) => [...prev, { role: `Firmante ${prev.length + 1}` }])
                }
                className="text-xs font-mono uppercase tracking-wider text-accent-brand hover:underline"
                disabled={signers.length >= 6}
              >
                + Agregar firmante
              </button>
              {signers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSigners((prev) => prev.slice(0, -1))}
                  className="text-xs font-mono uppercase tracking-wider text-content-subtle hover:underline"
                >
                  − Quitar último
                </button>
              )}
            </div>

            <div className="flex items-start gap-2 text-[11px] text-content-subtle bg-accent-brand-subtle/40 border border-hairline rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-accent-brand shrink-0 mt-0.5" />
              <span>
                Se genera un hash del documento (SHA-256), un token único por firmante y un QR de
                verificación pública. La firma queda con trazabilidad legal en la plataforma.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-content-subtle hover:text-content"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-brand text-white px-4 py-2 text-sm font-medium hover:bg-accent-brand/90 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Crear solicitud de firma
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              Solicitud creada. Comparte estos enlaces con cada firmante — se muestran{" "}
              <b>una sola vez</b>.
            </div>
            <div className="space-y-2">
              {issued.map((link) => (
                <div
                  key={link.url}
                  className="rounded-xl border border-hairline bg-surface-2 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs font-mono uppercase tracking-wider text-content-subtle">
                      {link.role}
                    </div>
                    {link.email && (
                      <div className="text-[10px] text-content-subtle">→ {link.email}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] break-all bg-white border border-hairline rounded px-2 py-1.5 text-content">
                      {link.url}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(link.url)}
                      className="p-2 rounded hover:bg-surface-3 text-content-subtle"
                      title="Copiar"
                    >
                      {copied === link.url ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded hover:bg-surface-3 text-content-subtle"
                      title="Abrir"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Link
                to="/dashboard/firmas"
                className="text-sm text-accent-brand hover:underline inline-flex items-center gap-1"
              >
                <ShieldCheck className="w-4 h-4" /> Ver estado en Mis firmas
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-content text-white rounded-lg hover:bg-content/90"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
