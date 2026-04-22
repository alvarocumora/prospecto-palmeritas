import { useState } from "react";
import { ExternalLink, Newspaper, Scale, Plus, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { useHolderLinks } from "@/hooks/useHolderLinks";
import { toast } from "sonner";

export function HolderLinksPanel({
  holderId,
  projectId,
  userId,
}: {
  holderId: string;
  projectId: string;
  userId: string;
}) {
  const { data, loading, addExternal, remove, rescan } = useHolderLinks(holderId);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const onAdd = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await addExternal({ holderId, projectId, userId, url: url.trim(), label: label.trim() || undefined });
      setUrl("");
      setLabel("");
      toast.success("Enlace agregado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onRescan = async () => {
    setBusy(true);
    try {
      await rescan(holderId);
      toast.success("Re-escaneo completado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Bulletins */}
      <div className="border border-border rounded">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary/40">
          <div className="font-mono text-[11px] uppercase tracking-wider text-text-secondary inline-flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-signal-cyan" /> Boletín minero ({data.bulletins.length})
          </div>
          <button
            onClick={onRescan}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} /> Re-escanear
          </button>
        </div>
        {loading ? (
          <div className="p-3 text-xs text-text-secondary text-center">Cargando…</div>
        ) : data.bulletins.length === 0 ? (
          <div className="p-3 text-xs text-text-secondary text-center">Sin coincidencias. Usa "Re-escanear" tras editar el RUT/nombre.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.bulletins.map((l) => (
              <div key={l.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-secondary w-20 shrink-0">
                  {l.bulletin?.publication_date ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{l.bulletin?.publication_type ?? "—"}</span>
                    {l.bulletin?.concession_name && <span className="text-text-secondary"> · {l.bulletin.concession_name}</span>}
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    N° {l.bulletin?.publication_number ?? "—"} · {l.bulletin?.comuna ?? "—"}
                    {l.auto_matched && <span className="ml-2 inline-flex items-center gap-0.5 text-signal-cyan"><Sparkles className="w-2.5 h-2.5" />auto</span>}
                  </div>
                </div>
                {l.bulletin?.source_url && (
                  <a href={l.bulletin.source_url} target="_blank" rel="noreferrer" className="p-1 hover:bg-accent rounded">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button onClick={() => remove(l.id).catch(() => toast.error("Error"))} className="p-1 hover:bg-destructive/20 text-destructive rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Court cases */}
      <div className="border border-border rounded">
        <div className="px-3 py-2 border-b border-border bg-bg-secondary/40">
          <div className="font-mono text-[11px] uppercase tracking-wider text-text-secondary inline-flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-500" /> Causas PJUD ({data.cases.length})
          </div>
        </div>
        {data.cases.length === 0 ? (
          <div className="p-3 text-xs text-text-secondary text-center">Sin causas registradas.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.cases.map((l) => (
              <div key={l.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-secondary w-24 shrink-0">
                  {l.case?.case_number ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{l.case?.matter ?? "—"}</span>
                  </div>
                  <div className="text-[10px] text-text-secondary truncate">
                    {l.case?.court ?? "—"} · {l.case?.filed_at ?? ""} · {l.case?.status ?? ""}
                    {l.auto_matched && <span className="ml-2 inline-flex items-center gap-0.5 text-signal-cyan"><Sparkles className="w-2.5 h-2.5" />auto</span>}
                  </div>
                </div>
                {l.case?.source_url && (
                  <a href={l.case.source_url} target="_blank" rel="noreferrer" className="p-1 hover:bg-accent rounded">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button onClick={() => remove(l.id).catch(() => toast.error("Error"))} className="p-1 hover:bg-destructive/20 text-destructive rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External */}
      <div className="border border-border rounded">
        <div className="px-3 py-2 border-b border-border bg-bg-secondary/40 font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          Enlaces externos ({data.external.length})
        </div>
        <div className="p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Etiqueta (ej. CBR Valparaíso)"
              className="flex-1 text-xs bg-bg-secondary border border-border rounded px-2 py-1.5"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="flex-[2] text-xs bg-bg-secondary border border-border rounded px-2 py-1.5"
            />
            <button
              onClick={onAdd}
              disabled={busy || !url.trim()}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>
          {data.external.length > 0 && (
            <div className="divide-y divide-border border border-border rounded">
              {data.external.map((l) => (
                <div key={l.id} className="px-2 py-1.5 text-xs flex items-center gap-2">
                  <ExternalLink className="w-3 h-3 text-text-secondary" />
                  <a href={l.external_url ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                    {l.label || l.external_url}
                  </a>
                  <button onClick={() => remove(l.id).catch(() => toast.error("Error"))} className="p-1 hover:bg-destructive/20 text-destructive rounded">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
