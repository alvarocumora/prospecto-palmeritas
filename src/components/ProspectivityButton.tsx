import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Flame, Loader2, Trash2, Info } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProspectivity, type ProspectivityCell, type ProspectivityRun } from "@/hooks/useProspectivity";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  map: LeafletMap | null;
  onRunChange?: (cells: ProspectivityCell[], run: ProspectivityRun | null) => void;
}

export function ProspectivityButton({ map, onRunChange }: Props) {
  const { active } = useProjects();
  const { latestRun, cells, reload, loading: loadingCells } = useProspectivity(active?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  // Push current run/cells up to parent so it can render on map
  // (called every render — parent should memoize handler)
  if (onRunChange) {
    // schedule micro task to avoid setState during render
    queueMicrotask(() => onRunChange(cells, latestRun));
  }

  const generate = async () => {
    if (!active?.id || !map) {
      toast.error("Selecciona proyecto y abre el mapa");
      return;
    }
    const b = map.getBounds();
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prospectivity-grid`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          project_id: active.id,
          bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          cell_size_m: 250,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json.error ?? "Error generando heatmap");
        return;
      }
      toast.success(`Heatmap: ${json.cell_count} celdas, max ${json.max_score}/100`);
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar heatmap");
    } finally {
      setGenerating(false);
    }
  };

  const clearLatest = async () => {
    if (!active?.id || !latestRun) return;
    if (!confirm("¿Borrar el run actual de prospectividad?")) return;
    const { error: cellErr } = await supabase.from("prospectivity_cells").delete().eq("project_id", active.id).eq("run_id", latestRun.id);
    if (cellErr) { toast.error(cellErr.message); return; }
    await supabase.from("prospectivity_runs").delete().eq("id", latestRun.id);
    toast.success("Run eliminado");
    await reload();
  };

  return (
    <div className="absolute top-14 left-3 z-[500] flex flex-col gap-1.5 max-w-[200px]">
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gold/50 bg-bg-secondary/95 backdrop-blur text-foreground hover:bg-gold/10 hover:border-gold disabled:opacity-50 text-[11px] font-mono shadow-md transition-colors"
        title="Generar heatmap de prospectividad sobre la vista actual del mapa"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" /> : <Flame className="w-3.5 h-3.5 text-gold" />}
        <span className="hidden sm:inline">Prospectividad IA</span>
      </button>
      {latestRun && (
        <div className="rounded border border-border bg-bg-secondary/95 backdrop-blur px-2 py-1.5 text-[10px] font-mono text-muted-foreground shadow-md">
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 hover:text-foreground">
            <Info className="w-3 h-3" />
            {cells.length} celdas · {new Date(latestRun.generated_at).toLocaleDateString()}
          </button>
          {open && (
            <div className="mt-1.5 pt-1.5 border-t border-border space-y-1">
              <div>Tamaño celda: {latestRun.cell_size_m} m</div>
              <div>Total registradas: {latestRun.cell_count}</div>
              {loadingCells && <div>Cargando…</div>}
              <button onClick={clearLatest} className="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 mt-1">
                <Trash2 className="w-3 h-3" /> Borrar run
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
