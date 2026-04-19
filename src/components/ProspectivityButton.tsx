import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Flame, Loader2, Trash2, Info } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProspectivity } from "@/hooks/useProspectivity";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  map: LeafletMap | null;
  onCellsChange?: () => void;
}

export function ProspectivityButton({ map, onCellsChange }: Props) {
  const { active } = useProjects();
  const { latestRun, cells, reload, loading: loadingCells } = useProspectivity(active?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (!active?.id || !map) {
      toast.error("Selecciona proyecto y mapa");
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
      toast.success(`Heatmap generado: ${json.cell_count} celdas, max ${json.max_score}/100`);
      await reload();
      onCellsChange?.();
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
    onCellsChange?.();
  };

  return (
    <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-orange-500/50 bg-bg-secondary/95 backdrop-blur text-foreground hover:bg-orange-500/10 hover:border-orange-500 disabled:opacity-50 text-[11px] font-mono shadow-md transition-colors"
        title="Generar heatmap de prospectividad sobre la vista actual"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" /> : <Flame className="w-3.5 h-3.5 text-orange-500" />}
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
              <button onClick={clearLatest} className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 mt-1">
                <Trash2 className="w-3 h-3" /> Borrar run
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
