// Sección pública de data room en /proyectos/:id.
// - Sin sesión: muestra CTA "Solicitar acceso" → /auth con redirect back.
// - Con sesión: permite firmar NDA (modal) y descargar archivos gated por NDA.
// Reutiliza signListingNda + upsertInquiry y listDataRoomFiles/getDataRoomDownloadUrl
// (que aplican el gating NDA server-side).
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Unlock, FileText, ShieldCheck, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DATA_ROOM_CATEGORY_LABELS,
  getDataRoomDownloadUrl,
  listDataRoomFiles,
  signNdaAndGrantAccess,
  type DataRoomFileRow,
} from "@/lib/dataRoom.functions";

type Aggregate = {
  totalFiles: number;
  ndaFiles: number;
  totalSizeBytes: number;
  categories: Array<{ category: string; count: number }>;
};

export function PublicDataRoomSection({
  listingId,
  listingTitle,
  aggregate,
}: {
  listingId: string;
  listingTitle: string;
  aggregate: Aggregate;
}) {
  const { user, loading: authLoading } = useAuth();
  const [ndaSigned, setNdaSigned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [files, setFiles] = useState<DataRoomFileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Cargar estado NDA + archivos si el visitante está logueado
  const refresh = useCallback(async () => {
    setFiles([]);
    setNdaSigned(false);
    if (!user) return;
    setChecking(true);
    try {
      const { data: inq } = await supabase
        .from("property_deal_inquiries")
        .select("nda_signed_at")
        .eq("listing_id", listingId)
        .eq("inquirer_user_id", user.id)
        .maybeSingle();
      const signed = !!inq?.nda_signed_at;
      setNdaSigned(signed);
      if (signed) {
        setFilesLoading(true);
        try {
          setFiles(await listDataRoomFiles({ data: { listingId } }));
        } finally {
          setFilesLoading(false);
        }
      }
    } catch (error) {
      setFiles([]);
      toast.error(
        error instanceof Error ? error.message : "No se pudo verificar el acceso al expediente.",
      );
    } finally {
      setChecking(false);
    }
  }, [user, listingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onDownload = async (f: DataRoomFileRow) => {
    try {
      const { url } = await getDataRoomDownloadUrl({ data: { listingId, fileId: f.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al descargar");
    }
  };

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="brand-eyebrow">Data room</div>
        <span className="text-[11px] font-mono text-content-subtle">
          {aggregate.totalFiles > 0
            ? `${aggregate.totalFiles} documentos · ${(aggregate.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`
            : "En preparación por el titular"}
        </span>
      </div>

      {aggregate.totalFiles === 0 ? (
        <p className="text-sm text-content-subtle">
          El titular está preparando la documentación del data room. Solicita acceso para que te
          notifiquemos cuando esté disponible.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          {aggregate.categories.map((c) => (
            <span
              key={c.category}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-hairline text-[11px] font-mono text-content"
            >
              {DATA_ROOM_CATEGORY_LABELS[c.category] ?? c.category}
              <span className="text-content-subtle">×{c.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Estado + CTA principal */}
      {authLoading ? null : !user ? (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-hairline bg-accent-brand-subtle p-4">
          <div className="text-sm text-content">
            <Lock className="w-4 h-4 inline text-accent-brand mr-1.5 -mt-0.5" />
            Firma el NDA y solicita acceso al data room para descargar los documentos.
          </div>
          <Link
            to="/auth"
            search={{ intent: "investor", next: `/proyectos/${listingId}` } as never}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Iniciar sesión para acceder
          </Link>
        </div>
      ) : checking ? (
        <div className="mt-4 text-xs text-content-subtle">
          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" /> Verificando acceso…
        </div>
      ) : !ndaSigned ? (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-hairline bg-accent-brand-subtle p-4">
          <div className="text-sm text-content">
            <ShieldCheck className="w-4 h-4 inline text-accent-brand mr-1.5 -mt-0.5" />
            Firma el NDA para consultar los documentos incluidos en tu permiso de acceso.
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Solicitar acceso / Firmar NDA
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="text-xs text-teal mb-3 inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> NDA firmado · documentos según tu permiso
            vigente
          </div>
          {filesLoading ? (
            <div className="text-xs text-content-subtle">
              <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" /> Cargando archivos…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-content-subtle">
              No hay documentos disponibles con tu permiso actual. Contacta al equipo para revisar
              el acceso o el estado del expediente.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-hairline hover:border-accent-brand/40"
                >
                  {f.requires_nda ? (
                    <Lock className="w-3.5 h-3.5 text-accent-brand shrink-0" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-teal shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-content truncate">
                      <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      {f.file_name}
                    </div>
                    <div className="text-[11px] font-mono text-content-subtle">
                      {DATA_ROOM_CATEGORY_LABELS[f.category ?? ""] ?? f.category ?? "documento"}
                      {f.file_size_bytes
                        ? ` · ${(f.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                        : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDownload(f)}
                    className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1 text-[11px] font-mono hover:border-accent-brand"
                  >
                    <Download className="w-3 h-3" /> Descargar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modalOpen && user && (
        <NdaModal
          listingId={listingId}
          listingTitle={listingTitle}
          userEmail={user.email ?? "signed"}
          onClose={() => setModalOpen(false)}
          onSigned={() => {
            setModalOpen(false);
            void refresh();
          }}
        />
      )}
    </section>
  );
}

function NdaModal({
  listingId,
  listingTitle,
  userEmail,
  onClose,
  onSigned,
}: {
  listingId: string;
  listingTitle: string;
  userEmail: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!accepted) {
      toast.error("Debes aceptar los términos del NDA");
      return;
    }
    setSubmitting(true);
    try {
      await signNdaAndGrantAccess({
        data: { listingId, signature: userEmail, message: message.trim() || null },
      });
      toast.success("NDA firmado · acceso al data room habilitado");
      onSigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar el NDA");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white border border-hairline shadow-xl">
        <header className="flex items-center justify-between p-4 border-b border-hairline">
          <h3 className="text-sm font-semibold text-content">NDA · {listingTitle}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4 text-content-subtle" />
          </button>
        </header>
        <div className="p-4 space-y-3 text-sm text-content">
          <div className="max-h-52 overflow-y-auto rounded border border-hairline bg-accent-brand-subtle/30 p-3 text-xs text-content leading-relaxed">
            <p className="font-semibold mb-2">Acuerdo de confidencialidad simplificado</p>
            <p>
              Al aceptar, el Receptor se obliga a mantener en estricta confidencialidad toda la
              información técnica, financiera, legal y comercial del proyecto{" "}
              <strong>{listingTitle}</strong> a la que acceda dentro de la plataforma Geocapitals.
            </p>
            <p className="mt-2">
              La información se usará exclusivamente para evaluar una potencial transacción y no
              podrá ser divulgada a terceros sin autorización escrita del Titular. Vigencia: 24
              meses desde la fecha de firma.
            </p>
            <p className="mt-2">
              Firma electrónica: <span className="font-mono">{userEmail}</span> · Fecha:{" "}
              {new Date().toLocaleString("es-CL")}
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-content-subtle">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            He leído y acepto los términos del NDA anterior.
          </label>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wide text-content-subtle mb-1">
              Mensaje al titular (opcional)
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="Cuéntanos brevemente tu tesis o tipo de inversión…"
              className="w-full rounded border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-accent-brand"
            />
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 p-4 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-hairline px-3 py-1.5 text-xs font-mono hover:border-content-subtle"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !accepted}
            className="inline-flex items-center gap-1.5 rounded bg-accent-brand text-white px-4 py-2 text-xs font-mono font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Firmar NDA
          </button>
        </footer>
      </div>
    </div>
  );
}
