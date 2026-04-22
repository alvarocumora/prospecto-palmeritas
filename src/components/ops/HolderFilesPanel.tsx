import { useRef, useState } from "react";
import { Upload, Trash2, Download, FileText, Eye } from "lucide-react";
import { useHolderFiles, FILE_TYPE_LABELS, type HolderFile } from "@/hooks/useHolderFiles";
import { toast } from "sonner";
import { FilePreviewModal } from "./FilePreviewModal";

const PREVIEWABLE = /\.(pdf|png|jpe?g|webp|gif|svg)$/i;

function fmtSize(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function HolderFilesPanel({
  holderId,
  projectId,
  userId,
}: {
  holderId: string;
  projectId: string;
  userId: string;
}) {
  const { data, loading, upload, remove, getDownloadUrl } = useHolderFiles(holderId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState("otros");
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<HolderFile | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      await upload(f, { holderId, projectId, userId, fileType });
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
      await remove({ id, file_path: path } as Parameters<typeof remove>[0]);
      toast.success("Eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="border border-border rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary/40">
        <div className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          Archivos ({data.length})
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="text-[11px] bg-bg-secondary border border-border rounded px-2 py-1"
          >
            {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground cursor-pointer hover:opacity-90">
            <Upload className="w-3 h-3" /> {busy ? "Subiendo…" : "Subir"}
            <input ref={inputRef} type="file" className="hidden" onChange={onFile} disabled={busy} />
          </label>
        </div>
      </div>
      {loading ? (
        <div className="p-4 text-center text-xs text-text-secondary">Cargando…</div>
      ) : data.length === 0 ? (
        <div className="p-4 text-center text-xs text-text-secondary">Sin archivos. Sube escrituras, poderes o RUT.</div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((f) => {
            const canPreview = PREVIEWABLE.test(f.file_name);
            return (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => canPreview && setPreviewing(f)}
                  disabled={!canPreview}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left disabled:cursor-default group"
                  title={canPreview ? "Previsualizar" : f.file_name}
                >
                  <FileText className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-mono ${canPreview ? "group-hover:text-primary" : ""}`}>{f.file_name}</div>
                    <div className="text-[10px] text-text-secondary">
                      {FILE_TYPE_LABELS[f.file_type] ?? f.file_type} · {fmtSize(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleDateString("es-CL")}
                    </div>
                  </div>
                </button>
                {canPreview && (
                  <button onClick={() => setPreviewing(f)} className="p-1 rounded hover:bg-accent" title="Previsualizar" aria-label="Previsualizar">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => onDownload(f.file_path)} className="p-1 rounded hover:bg-accent" title="Descargar">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onRemove(f.id, f.file_path)} className="p-1 rounded hover:bg-destructive/20 text-destructive" title="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <FilePreviewModal file={previewing} getDownloadUrl={getDownloadUrl} onClose={() => setPreviewing(null)} />
    </div>
  );
}
