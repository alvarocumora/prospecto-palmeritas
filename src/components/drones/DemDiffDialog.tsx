// Sprint 6.4 — dialog para crear un DEM diff entre dos rasters DSM/DTM.
import { useState } from "react";
import { Loader2, X, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import { runDemDiff } from "@/hooks/useDroneAnalysis";

interface Props {
  projectId: string;
  userId: string;
  rasters: DroneRaster[];
  onClose: () => void;
  onSaved: () => void;
}

export function DemDiffDialog({ projectId, userId, rasters, onClose, onSaved }: Props) {
  const dsmRasters = rasters.filter((r) =>
    ["dsm", "dtm", "dem"].includes(r.raster_type) && r.storage_path && r.bounds_geojson,
  );
  const [name, setName] = useState("");
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nombre requerido");
    if (!beforeId || !afterId) return toast.error("Selecciona ambos rasters");
    if (beforeId === afterId) return toast.error("Los rasters deben ser diferentes");
    setRunning(true);
    const { data, error } = await runDemDiff({
      projectId, userId, name: name.trim(), rasterBeforeId: beforeId, rasterAfterId: afterId, notes: notes.trim() || undefined,
    });
    setRunning(false);
    if (error || !data) return toast.error(error ?? "Error en el cálculo");
    toast.success(`Diff calculado: net ${data.net_volume_m3?.toFixed(0)} m³`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-mono font-semibold">Comparar DSM (cut/fill)</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3 text-xs font-mono">
          {dsmRasters.length < 2 && (
            <div className="p-2 rounded bg-warning/10 border border-warning/30 text-warning">
              Necesitas al menos 2 rasters DSM/DTM/DEM con metadata extraída para comparar.
            </div>
          )}
          <Field label="Nombre del análisis" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stockpile A — Ago vs Oct"
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary" />
          </Field>
          <Field label="DSM antes (T1)" required>
            <select value={beforeId} onChange={(e) => setBeforeId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary">
              <option value="">— Selecciona —</option>
              {dsmRasters.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.captured_at ?? "sin fecha"})</option>
              ))}
            </select>
          </Field>
          <Field label="DSM después (T2)" required>
            <select value={afterId} onChange={(e) => setAfterId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary">
              <option value="">— Selecciona —</option>
              {dsmRasters.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.captured_at ?? "sin fecha"})</option>
              ))}
            </select>
          </Field>
          <Field label="Notas">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary" />
          </Field>
          <div className="text-[10px] text-muted-foreground bg-bg-secondary p-2 rounded">
            ⓘ Se calcula sobre la intersección de bounds (máx 256×256 celdas). Asume DSM proyectados (UTM).
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={running}
              className="px-3 py-1.5 rounded border border-border hover:bg-accent">Cancelar</button>
            <button type="submit" disabled={running || dsmRasters.length < 2}
              className="px-3 py-1.5 rounded bg-gold text-bg-primary font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
              {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {running ? "Calculando…" : "Calcular cut/fill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase text-muted-foreground mb-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
