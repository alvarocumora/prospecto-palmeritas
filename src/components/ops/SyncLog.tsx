import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { HudPanel } from "@/components/ops/HudPanel";
import { useConcessionHistory } from "@/hooks/useConcessionHistory";
import { useMiningConcessions } from "@/hooks/useMiningConcessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SyncLog({ projectId }: { projectId: string }) {
  const { data, loading, refresh } = useConcessionHistory(projectId);
  const { data: concessions, refresh: refreshConcessions } = useMiningConcessions(projectId);
  const [syncing, setSyncing] = useState(false);

  const concessionMap = new Map(concessions.map((c) => [c.id, `${c.code} — ${c.name}`]));

  const onSync = async () => {
    setSyncing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("sync-sernageomin", {
        body: { projectId },
      });
      if (error) throw error;
      toast.success(`Sync OK · ${result?.checked ?? 0} concesiones · ${result?.changed ?? 0} cambios`);
      refresh();
      refreshConcessions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <HudPanel
      title="SERNAGEOMIN · Sync log"
      accent="cyan"
      className="bg-bg-panel/40"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          {data.length} eventos registrados
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan text-[10px] font-mono uppercase hover:bg-signal-cyan/20 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sincronizar ahora
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-center text-[11px] font-mono text-text-dim">CARGANDO…</div>
      ) : data.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-[2px]">
          <div className="text-[11px] font-mono text-text-dim">
            Sin sincronizaciones aún. Ejecuta el sync para traer datos vivos de SERNAGEOMIN.
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] divide-y divide-border max-h-[400px] overflow-y-auto">
          {data.map((h) => {
            const hasDiff = h.diff && Object.keys(h.diff).length > 0;
            return (
              <div key={h.id} className="px-2.5 py-1.5 hover:bg-accent/30">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasDiff ? "bg-signal-amber" : "bg-signal-green"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono truncate">
                      {concessionMap.get(h.concession_id) ?? h.concession_id.slice(0, 8)}
                    </div>
                    <div className="text-[10px] text-text-dim">
                      {new Date(h.synced_at).toLocaleString("es-CL")} · {h.source}
                      {hasDiff && ` · ${Object.keys(h.diff!).length} campo${Object.keys(h.diff!).length === 1 ? "" : "s"} cambiados`}
                    </div>
                    {hasDiff && (
                      <div className="text-[10px] mt-1 font-mono text-signal-amber">
                        {Object.entries(h.diff!).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="mr-2">{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HudPanel>
  );
}
