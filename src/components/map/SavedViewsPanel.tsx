// Sprint 6.3 — UI panel para guardar/restaurar vistas del mapa.
// Compacto, anclado abajo-derecha; muestra lista de vistas con click-to-restore.

import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Bookmark, Plus, Trash2, MapPin, X } from "lucide-react";
import { useMapViews, type MapView, type MapViewLayerState } from "@/hooks/useMapViews";

interface Props {
  projectId: string | null;
  map: LeafletMap | null;
  layerState: MapViewLayerState;
  onRestore: (view: MapView) => void;
}

export function SavedViewsPanel({ projectId, map, layerState, onRestore }: Props) {
  const { views, saveView, deleteView } = useMapViews(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!projectId) return null;

  const handleSave = async () => {
    if (!map || !name.trim()) return;
    setSaving(true);
    const c = map.getCenter();
    await saveView({
      name: name.trim(),
      center_lat: c.lat,
      center_lng: c.lng,
      zoom: map.getZoom(),
      layer_state: layerState,
    });
    setName("");
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-3 right-[200px] z-[500] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-bg-secondary/95 backdrop-blur text-[11px] font-mono text-foreground hover:bg-accent shadow-md"
        title="Vistas guardadas"
      >
        <Bookmark className="w-3.5 h-3.5 text-gold" />
        <span>Vistas{views.length > 0 ? ` (${views.length})` : ""}</span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 right-[200px] z-[600] w-72 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl flex flex-col max-h-[60vh]">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-gold" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Vistas guardadas ({views.length})
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" title="Cerrar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 border-b border-border flex gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Nombre de la vista…"
          className="flex-1 px-2 py-1 text-[11px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
          maxLength={60}
        />
        <button
          onClick={handleSave}
          disabled={!name.trim() || !map || saving}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gold text-bg-primary text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-40"
          title="Guardar vista actual"
        >
          <Plus className="w-3 h-3" />
          Guardar
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-1">
        {views.length === 0 ? (
          <div className="px-2 py-4 text-center text-[10px] font-mono text-muted-foreground">
            Sin vistas guardadas. Guarda zoom, centro, capas y filtros con un clic.
          </div>
        ) : (
          views.map((v) => (
            <div key={v.id} className="group flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent">
              <button
                onClick={() => onRestore(v)}
                className="flex-1 flex items-start gap-1.5 text-left min-w-0"
                title="Restaurar esta vista"
              >
                <MapPin className="w-3 h-3 text-gold mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono font-semibold text-foreground truncate">{v.name}</div>
                  <div className="text-[9px] font-mono text-muted-foreground truncate">
                    z{v.zoom?.toFixed(1) ?? "—"} · {v.center_lat?.toFixed(3)},{v.center_lng?.toFixed(3)}
                  </div>
                </div>
              </button>
              <button
                onClick={() => deleteView(v.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
