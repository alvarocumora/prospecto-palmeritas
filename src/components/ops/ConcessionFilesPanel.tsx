import { useRef, useState } from "react";
import { Upload, Trash2, Download, FileText, Image as ImageIcon, Eye } from "lucide-react";
import { useConcessionFiles, CONCESSION_FILE_TYPE_LABELS, type ConcessionFile } from "@/hooks/useConcessionFiles";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FilePreviewModal } from "./FilePreviewModal";

const PREVIEWABLE = /\.(pdf|png|jpe?g|webp|gif|svg)$/i;

function fmtSize(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/heic";

export function ConcessionFilesPanel({
  concessionId,
  projectId,
}: {
  concessionId: string;
  projectId: string;
}) {
  const { user } = useAuth();
  const { data, loading, upload, remove, getDownloadUrl } = useConcessionFiles(concessionId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState("titulo");
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<ConcessionFile | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!user?.id) {
      toast.error("Inicia sesión para subir archivos");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("Archivo demasiado grande (máx 25 MB)");
      return;
    }
    setBusy(true);
    try {
      await upload(f, { concessionId, projectId, userId: user.id, fileType });
      toast.success("Archivo subido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDownload = async (path: string) => {
    const url = await getDownloadUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo generar el link");
  };

  const onRemove = async (id: string, path: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await remove({ id, file_path: path });
      toast.success("Eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="border border-border rounded">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-secondary/40">
        <div className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          Archivos ({data.length})
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="text-[11px] bg-bg-secondary border border-border rounded px-2 py-1"
          >
            {Object.entries(CONCESSION_FILE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground cursor-pointer hover:opacity-90">
            <Upload className="w-3 h-3" /> {busy ? "Subiendo…" : "Subir"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onFile}
              disabled={busy}
            />
          </label>
        </div>
      </div>
      {loading ? (
        <div className="divide-y divide-border" aria-busy="true" aria-label="Cargando archivos">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="w-3.5 h-3.5 rounded-sm bg-bg-elevated shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 bg-bg-elevated rounded" style={{ width: `${70 - i * 10}%` }} />
                <div className="h-2 bg-bg-elevated/70 rounded" style={{ width: `${50 - i * 8}%` }} />
              </div>
              <div className="w-6 h-6 rounded bg-bg-elevated/70" />
              <div className="w-6 h-6 rounded bg-bg-elevated/70" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-4 text-center text-xs text-text-secondary">
          Sin archivos. Sube título, patente, planos o resoluciones (PDF / imagen, máx 25 MB).
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((f) => {
            const isImage = /\.(png|jpe?g|webp|heic)$/i.test(f.file_name);
            const Icon = isImage ? ImageIcon : FileText;
            return (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <Icon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono">{f.file_name}</div>
                  <div className="text-[10px] text-text-secondary">
                    {CONCESSION_FILE_TYPE_LABELS[f.file_type] ?? f.file_type} · {fmtSize(f.size_bytes)} ·{" "}
                    {new Date(f.uploaded_at).toLocaleDateString("es-CL")}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(f.file_path)}
                  className="p-1.5 rounded hover:bg-accent active:scale-95"
                  title="Descargar"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemove(f.id, f.file_path)}
                  className="p-1.5 rounded hover:bg-destructive/20 text-destructive active:scale-95"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
