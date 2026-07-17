import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle, ShieldCheck, ArrowLeft, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { PUBLIC_APP_HOST } from "@/lib/publicUrl";

type VerifyStatus =
  | "not_found"
  | "draft"
  | "pending_signature"
  | "signed"
  | "expired"
  | "void";

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
  { label: string; tone: string; icon: typeof CheckCircle2; description: string }
> = {
  signed: {
    label: "Documento firmado",
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: CheckCircle2,
    description: "La firma electrónica está registrada en Geocapitals y es válida.",
  },
  pending_signature: {
    label: "Pendiente de firma",
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    icon: Clock,
    description: "Este documento existe y está a la espera de la firma de la contraparte.",
  },
  draft: {
    label: "Borrador editable",
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    icon: FileText,
    description: "La referencia corresponde a un borrador en curso; aún no se ha enviado a firma.",
  },
  expired: {
    label: "Solicitud vencida",
    tone: "text-neutral-700 bg-neutral-100 border-neutral-300",
    icon: XCircle,
    description: "La solicitud de firma expiró. Solicita una nueva al emisor.",
  },
  void: {
    label: "Anulado",
    tone: "text-red-700 bg-red-50 border-red-200",
    icon: XCircle,
    description: "El emisor anuló este documento. No debe considerarse vigente.",
  },
  not_found: {
    label: "Referencia no encontrada",
    tone: "text-red-700 bg-red-50 border-red-200",
    icon: XCircle,
    description:
      "No existe ningún documento activo con esta referencia en Geocapitals. Verifica el código o contacta al emisor.",
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

function VerifyPage() {
  const { ref } = useParams({ from: "/verificar/$ref" });
  const [state, setState] = useState<{ loading: boolean; data?: VerifyResult; error?: string }>({
    loading: true,
  });

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

  const meta = state.data ? STATUS_META[state.data.status] : null;
  const Icon = meta?.icon ?? Clock;

  return (
    <main data-theme="im-light" className="min-h-screen bg-surface">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-content">
            <Logo size={22} />
          </Link>
          <a
            href="/"
            className="text-[12px] font-mono text-content-subtle hover:text-content inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a {PUBLIC_APP_HOST}
          </a>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand">
            Validación de documento
          </div>
          <h1 className="font-display text-3xl lg:text-4xl mt-2 text-content">
            Verificación electrónica
          </h1>
          <p className="text-sm text-content-subtle mt-2 max-w-2xl">
            Confirma la vigencia, referencia y estado de firma de un documento emitido en la
            plataforma Geocapitals.
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-white overflow-hidden shadow-sm">
          {/* Cabecera con referencia */}
          <div className="px-6 py-5 border-b border-hairline flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                Referencia consultada
              </div>
              <div className="font-mono text-lg text-content mt-1 break-all">{ref}</div>
            </div>
            <ShieldCheck className="w-6 h-6 text-accent-brand shrink-0" />
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
              <div className="px-6 py-5">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${meta?.tone}`}
                >
                  <Icon className="w-4 h-4" />
                  {meta?.label}
                </span>
                <p className="text-sm text-content mt-3">{meta?.description}</p>
              </div>

              {state.data.status !== "not_found" ? (
                <div className="border-t border-hairline">
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
                  </dl>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="border-t border-hairline bg-surface-subtle px-6 py-4 text-[11px] font-mono text-content-subtle">
            Esta página muestra metadatos públicos. El contenido del documento no se expone. Ante
            cualquier duda, contacta al emisor o escribe a{" "}
            <a href="mailto:info@geocapitals.com" className="text-accent-brand underline">
              info@geocapitals.com
            </a>
            .
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[12px] font-mono">
          <a
            href="https://wa.me/56962184071"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-hairline bg-white px-3 py-2 hover:border-accent-brand"
          >
            WhatsApp +56 9 6218 4071
          </a>
          <a
            href="mailto:info@geocapitals.com"
            className="rounded-lg border border-hairline bg-white px-3 py-2 hover:border-accent-brand"
          >
            info@geocapitals.com
          </a>
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
          "Verificación electrónica de documentos emitidos en Geocapitals: referencia, plantilla, fecha y estado de firma.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});
