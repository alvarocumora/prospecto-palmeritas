import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  FileText,
  Fingerprint,
  Upload,
  Copy,
  ExternalLink,
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { PUBLIC_APP_HOST, verifyDocUrl } from "@/lib/publicUrl";

type VerifyStatus = "not_found" | "draft" | "pending_signature" | "signed" | "expired" | "void";

type VerifyResult = {
  status: VerifyStatus;
  reference?: string;
  title?: string;
  template_id?: string;
  created_at?: string;
  updated_at?: string;
  signed_at?: string;
  expires_at?: string;
  signer?: string | null;
};

const STATUS_META: Record<
  VerifyStatus,
  {
    label: string;
    tone: string;
    icon: typeof CheckCircle2;
    description: string;
    validated: boolean;
  }
> = {
  signed: {
    label: "Documento validado",
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: CheckCircle2,
    description: "La firma electrónica está registrada en Geocapitals y es válida.",
    validated: true,
  },
  pending_signature: {
    label: "Pendiente de firma",
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    icon: Clock,
    description: "Este documento existe y está a la espera de la firma de la contraparte.",
    validated: false,
  },
  draft: {
    label: "Borrador editable",
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    icon: FileText,
    description: "La referencia corresponde a un borrador en curso; aún no se ha enviado a firma.",
    validated: false,
  },
  expired: {
    label: "Solicitud vencida",
    tone: "text-neutral-700 bg-neutral-100 border-neutral-300",
    icon: XCircle,
    description: "La solicitud de firma expiró. Solicita una nueva al emisor.",
    validated: false,
  },
  void: {
    label: "Anulado",
    tone: "text-red-700 bg-red-50 border-red-200",
    icon: XCircle,
    description: "El emisor anuló este documento. No debe considerarse vigente.",
    validated: false,
  },
  not_found: {
    label: "Referencia no encontrada",
    tone: "text-red-700 bg-red-50 border-red-200",
    icon: XCircle,
    description:
      "No existe ningún documento activo con esta referencia en Geocapitals. Verifica el código o contacta al emisor.",
    validated: false,
  },
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function VerifyPage() {
  const { ref } = useParams({ from: "/verificar/$ref" });
  const [state, setState] = useState<{ loading: boolean; data?: VerifyResult; error?: string }>({
    loading: true,
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<{ name: string; hash: string; size: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const canonicalUrl = useMemo(() => verifyDocUrl(ref), [ref]);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("verify_document", { p_ref: ref });
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error: error.message });
      } else {
        setState({ loading: false, data: (data ?? { status: "not_found" }) as VerifyResult });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(canonicalUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#0B2545", light: "#FAF7F1" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canonicalUrl]);

  const meta = state.data ? STATUS_META[state.data.status] : null;
  const Icon = meta?.icon ?? Clock;

  const handleFile = async (file: File) => {
    try {
      const hash = await sha256Hex(file);
      setFileHash({ name: file.name, hash, size: file.size });
    } catch (e) {
      setFileHash(null);
      console.error(e);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied by the browser; verification remains usable.
    }
  };

  return (
    <main data-theme="im-light" className="min-h-screen bg-surface">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-content">
            <Logo size={22} />
          </Link>
          <Link
            to="/verificar"
            className="text-[12px] font-mono text-content-subtle hover:text-content inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Verificar otro documento
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand">
            Validación pública de documento
          </div>
          <h1 className="font-display text-3xl lg:text-4xl mt-2 text-content">
            Verificación electrónica
          </h1>
          <p className="text-sm text-content-subtle mt-2 max-w-2xl">
            Página pública dedicada. Muestra los metadatos oficiales del documento emitido por
            Geocapitals, la huella SHA-256 (opcional) y el estado de validación consultado en el
            registro central.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          {/* Panel principal */}
          <div className="rounded-2xl border border-hairline bg-white overflow-hidden shadow-sm">
            {/* Cabecera con referencia y estado */}
            <div className="px-6 py-5 border-b border-hairline flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  Referencia consultada
                </div>
                <div className="font-mono text-lg text-content mt-1 break-all">{ref}</div>
              </div>
              {state.data && meta ? (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium ${meta.tone}`}
                >
                  <Icon className="w-4 h-4" />
                  {meta.label}
                </span>
              ) : (
                <ShieldCheck className="w-6 h-6 text-accent-brand shrink-0" />
              )}
            </div>

            {state.loading ? (
              <div className="p-10 text-center text-sm text-content-subtle">
                Consultando registro en Geocapitals…
              </div>
            ) : state.error ? (
              <div className="p-6 text-sm text-red-700 bg-red-50">
                No pudimos validar el documento: {state.error}
              </div>
            ) : state.data ? (
              <>
                {/* Banda VALIDADO / NO VALIDADO */}
                <div
                  className={`px-6 py-4 border-b border-hairline ${
                    meta?.validated ? "bg-emerald-50/60" : "bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full grid place-items-center ${
                        meta?.validated
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-300 text-neutral-700"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-lg text-content">
                        {meta?.validated ? "VALIDADO" : "NO VALIDADO"}
                      </div>
                      <p className="text-[13px] text-content-subtle max-w-2xl">
                        {meta?.description}
                      </p>
                    </div>
                  </div>
                </div>

                {state.data.status !== "not_found" ? (
                  <div>
                    <div className="px-6 pt-5 pb-2 text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                      Metadatos oficiales
                    </div>
                    <dl className="divide-y divide-hairline">
                      <Row label="Título" value={state.data.title ?? "—"} />
                      <Row label="Plantilla" value={state.data.template_id?.toUpperCase() ?? "—"} />
                      <Row label="Emitido" value={fmtDate(state.data.created_at)} />
                      <Row label="Última actualización" value={fmtDate(state.data.updated_at)} />
                      {state.data.signed_at ? (
                        <Row label="Firmado" value={fmtDate(state.data.signed_at)} />
                      ) : null}
                      {state.data.signer ? (
                        <Row label="Firmante" value={state.data.signer} mono />
                      ) : null}
                      {state.data.expires_at && state.data.status === "pending_signature" ? (
                        <Row label="Vence" value={fmtDate(state.data.expires_at)} />
                      ) : null}
                      <Row label="Emisor" value="Geocapitals SpA" />
                    </dl>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* SHA-256 opcional */}
            <div className="border-t border-hairline px-6 py-5 bg-surface-subtle/40">
              <div className="flex items-center gap-2 text-content mb-2">
                <Fingerprint className="w-4 h-4 text-accent-brand" />
                <span className="font-medium text-sm">Huella SHA-256 del PDF</span>
              </div>
              <p className="text-[13px] text-content-subtle mb-3">
                Sube el PDF que recibiste (no se envía a ningún servidor) para calcular su huella
                criptográfica y compararla out-of-band con la que informó el emisor. Debe coincidir
                carácter por carácter.
              </p>
              <label className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 text-sm cursor-pointer hover:border-accent-brand">
                <Upload className="w-4 h-4" />
                Elegir PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {fileHash ? (
                <div className="mt-3 rounded-lg border border-hairline bg-white px-3 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[12px] text-content">
                    <FileText className="w-3.5 h-3.5 text-accent-brand" />
                    <span className="truncate font-mono">{fileHash.name}</span>
                    <span className="text-content-subtle ml-auto">
                      {(fileHash.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-content-subtle break-all">
                    SHA-256 · {fileHash.hash}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-hairline bg-surface-subtle px-6 py-4 text-[11px] font-mono text-content-subtle">
              Esta página muestra metadatos públicos. El contenido del documento no se expone. Ante
              cualquier duda escribe a{" "}
              <a href="mailto:info@geocapitals.com" className="text-accent-brand underline">
                info@geocapitals.com
              </a>
              .
            </div>
          </div>

          {/* Panel lateral · QR + link canónico */}
          <aside className="rounded-2xl border border-hairline bg-white p-5 shadow-sm">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
              Enlace de verificación
            </div>
            <div className="rounded-xl border border-hairline bg-surface p-3 grid place-items-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR verificación ${ref}`} className="w-48 h-48" />
              ) : (
                <canvas ref={qrCanvasRef} className="w-48 h-48" />
              )}
            </div>
            <div className="mt-3 text-[11px] font-mono text-content-subtle break-all">
              {canonicalUrl}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 text-sm hover:border-accent-brand"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
              <a
                href={canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-brand text-white px-3 py-2 text-sm font-medium hover:bg-accent-brand/90"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en {PUBLIC_APP_HOST}
              </a>
            </div>
            <div className="mt-4 flex items-start gap-2 text-[11px] text-content-subtle">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-accent-brand shrink-0" />
              <span>
                El QR y este enlace son el destino oficial de verificación impreso en cada PDF
                emitido por Geocapitals.
              </span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 px-6 py-3">
      <dt className="text-[11px] font-mono uppercase tracking-wide text-content-subtle self-center">
        {label}
      </dt>
      <dd className={`text-sm text-content ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export const Route = createFileRoute("/verificar/$ref")({
  component: VerifyPage,
  head: ({ params }) => ({
    meta: [
      { title: `Validar documento ${params.ref} · Geocapitals` },
      {
        name: "description",
        content:
          "Verificación electrónica pública de documentos emitidos en Geocapitals: metadatos oficiales, huella SHA-256 y estado validado.",
      },
      { property: "og:title", content: `Verificación ${params.ref} · Geocapitals` },
      {
        property: "og:description",
        content:
          "Página pública dedicada de verificación con metadatos, hash SHA-256 y estado validado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
