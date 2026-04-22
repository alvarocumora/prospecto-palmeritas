import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2, FileText } from "lucide-react";

type PreviewFile = { file_path: string; file_name: string; file_type: string };

function detectKind(name: string): "pdf" | "image" | "heic" | "other" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(lower)) return "image";
  if (/\.heic$/i.test(lower)) return "heic";
  return "other";
}

export function FilePreviewModal({
  file,
  getDownloadUrl,
  onClose,
}: {
  file: PreviewFile | null;
  getDownloadUrl: (path: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setUrl(null);
      setError(null);
      setDragY(0);
      return;
    }
    setLoading(true);
    setError(null);
    getDownloadUrl(file.file_path)
      .then((u) => {
        if (cancelled) return;
        if (!u) setError("No se pudo generar el enlace");
        else setUrl(u);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file, getDownloadUrl]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [file, onClose]);

  if (!file) return null;

  const kind = detectKind(file.file_name);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onPointerUp = () => {
    if (dragY > 120) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={file.file_name}
      className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-bg-primary w-full md:w-[min(1100px,95vw)] md:h-[90vh] h-full md:rounded-lg overflow-hidden flex flex-col shadow-2xl"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? "none" : "transform 200ms" }}
      >
        {/* Header (drag handle on mobile) */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary/60 shrink-0 touch-none md:touch-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="md:hidden w-10 h-1 rounded-full bg-border absolute left-1/2 -translate-x-1/2 top-1.5" />
          <FileText className="w-4 h-4 text-text-secondary shrink-0 mt-1 md:mt-0" />
          <div className="min-w-0 flex-1 mt-1 md:mt-0">
            <div className="truncate text-xs font-mono">{file.file_name}</div>
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">{kind}</div>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-accent active:scale-95"
              title="Descargar"
              aria-label="Descargar archivo"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent active:scale-95"
            aria-label="Cerrar previsualización"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 bg-black/30 flex items-center justify-center overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-text-secondary text-xs">
              <Loader2 className="w-5 h-5 animate-spin" />
              Cargando previsualización…
            </div>
          ) : error ? (
            <div className="text-center p-6 text-xs text-destructive">{error}</div>
          ) : !url ? null : kind === "pdf" ? (
            <iframe
              src={url}
              title={file.file_name}
              className="w-full h-full border-0 bg-white"
            />
          ) : kind === "image" ? (
            <img
              src={url}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="text-xs text-text-secondary">
                {kind === "heic"
                  ? "Las imágenes HEIC no se pueden previsualizar en el navegador."
                  : "Este tipo de archivo no admite previsualización."}
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                <Download className="w-3.5 h-3.5" /> Abrir / Descargar
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
