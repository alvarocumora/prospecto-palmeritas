// Gestor de data room del dueño: subir, listar y eliminar archivos del listing.
// La subida va directo a storage con una signed upload URL emitida por el
// servidor (el bucket es privado; no hay policies de cliente).
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Lock, Trash2, Upload, Unlock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DATA_ROOM_CATEGORIES,
  DATA_ROOM_CATEGORY_LABELS,
  deleteDataRoomFile,
  getDataRoomDownloadUrl,
  listDataRoomFiles,
  registerDataRoomFile,
  requestDataRoomUpload,
  type DataRoomFileRow,
} from "@/lib/dataRoom.functions";

export function DataRoomManager({ listingId }: { listingId: string }) {
  const [files, setFiles] = useState<DataRoomFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>("00");
  const [requiresNda, setRequiresNda] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await listDataRoomFiles({ data: { listingId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando data room");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Máximo 100 MB por archivo.");
      return;
    }
    setUploading(true);
    try {
      const { path, token, bucket } = await requestDataRoomUpload({
        data: { listingId, fileName: file.name },
      });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (up.error) throw up.error;
      await registerDataRoomFile({
        data: {
          listingId,
          filePath: path,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || null,
          category,
          requiresNda,
        },
      });
      toast.success(`Subido: ${file.name}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (f: DataRoomFileRow) => {
    if (!window.confirm(`¿Eliminar "${f.file_name}" del data room?`)) return;
    try {
      await deleteDataRoomFile({ data: { listingId, fileId: f.id } });
      toast.success("Archivo eliminado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const onDownload = async (f: DataRoomFileRow) => {
    try {
      const { url } = await getDataRoomDownloadUrl({ data: { listingId, fileId: f.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al descargar");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          Data room ({files.length})
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 text-[11px] font-mono"
          >
            {DATA_ROOM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DATA_ROOM_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={requiresNda}
              onChange={(e) => setRequiresNda(e.target.checked)}
            />
            NDA
          </label>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded bg-gold text-black px-2.5 py-1 text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Subir
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
        </div>
      </div>

      {loading ? (
        <div className="text-[11px] font-mono text-muted-foreground py-2">Cargando…</div>
      ) : files.length === 0 ? (
        <div className="text-[11px] font-mono text-muted-foreground py-2">
          Sin archivos. Sube el NI 43-101, títulos de concesión y modelo financiero — es lo primero
          que pide un comité de inversión.
        </div>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-border"
            >
              {f.requires_nda ? (
                <Lock className="w-3 h-3 text-warn shrink-0" />
              ) : (
                <Unlock className="w-3 h-3 text-teal shrink-0" />
              )}
              <button
                type="button"
                onClick={() => void onDownload(f)}
                className="flex-1 min-w-0 text-left hover:text-gold transition-colors"
                title="Descargar"
              >
                <span className="block text-[11px] font-mono text-foreground truncate">
                  <FileText className="w-3 h-3 inline mr-1 -mt-0.5" />
                  {f.file_name}
                </span>
                <span className="block text-[10px] font-mono text-muted-foreground">
                  {DATA_ROOM_CATEGORY_LABELS[f.category ?? ""] ?? f.category ?? "documento"}
                  {f.file_size_bytes ? ` · ${(f.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}
                  {f.requires_nda ? " · requiere NDA" : " · público al deal"}
                  {f.pending ? " · pendiente de carga" : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void onDelete(f)}
                className="text-muted-foreground hover:text-danger transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
