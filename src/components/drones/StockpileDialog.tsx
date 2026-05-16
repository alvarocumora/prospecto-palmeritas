// Sprint 6.5 — dialog para calcular volumen de stockpile.
// El usuario pega un GeoJSON Polygon (lng,lat). En sprint futuro: dibujar en mapa.
import { useState } from "react";
import { Loader2, X, Boxes } from "lucide-react";
import { toast } from "sonner";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import { runStockpileVolume } from "@/hooks/useDroneAnalysis";

interface Props {
  projectId: string;
  userId: string;
  rasters: DroneRaster[];
  onClose: () => void;
  onSaved: () => void;
}

export function StockpileDialog({ projectId, userId, rasters, onClose, onSaved }: Props) {
  const dsmRasters = rasters.filter(
    (r) => ["dsm", "dtm", "dem"].includes(r.raster_type) && r.storage_path,
  );
  const [name, setName] = useState("");
  const [material, setMaterial] = useState("");
  const [rasterId, setRasterId] = useState("");
  const [polygonText, setPolygonText] = useState("");
  const [baseMethod, setBaseMethod] = useState<"edge_mean" | "min" | "fixed">("edge_mean");
  const [baseFixed, setBaseFixed] = useState("");
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nombre requerido");
    if (!rasterId) return toast.error("Selecciona el DSM");
    let poly: GeoJSON.Polygon;
    try {
      const parsed = JSON.parse(polygonText);
      const geom: GeoJSON.Geometry | null =
        parsed?.type === "Polygon"
          ? parsed
          : parsed?.type === "Feature" && parsed.geometry?.type === "Polygon"
            ? parsed.geometry
            : parsed?.type === "FeatureCollection" &&
                parsed.features?.[0]?.geometry?.type === "Polygon"
              ? parsed.features[0].geometry
              : null;
      if (!geom || geom.type !== "Polygon") throw new Error("No es un Polygon");
      poly = geom as GeoJSON.Polygon;
    } catch (err) {
      return toast.error(
        `Polígono inválido: ${err instanceof Error ? err.message : "JSON malformado"}`,
      );
    }

    setRunning(true);
    const { data, error } = await runStockpileVolume({
      projectId,
      userId,
      rasterId,
      name: name.trim(),
      material: material.trim() || null,
      polygonGeojson: poly,
      baseMethod,
      baseElevationM: baseMethod === "fixed" && baseFixed ? Number(baseFixed) : null,
      notes: notes.trim() || null,
    });
    setRunning(false);
    if (error || !data) return toast.error(error ?? "Error");
    toast.success(`Volumen: ${data.volume_m3?.toLocaleString()} m³`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-mono font-semibold">Calcular volumen stockpile</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3 text-xs font-mono">
          {dsmRasters.length === 0 && (
            <div className="p-2 rounded bg-warning/10 border border-warning/30 text-warning">
              Sube al menos un DSM con storage para medir volúmenes.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nombre" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acopio norte"
                className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
              />
            </Field>
            <Field label="Material">
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="ROM, mineral, estéril…"
                className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
              />
            </Field>
          </div>
          <Field label="DSM" required>
            <select
              value={rasterId}
              onChange={(e) => setRasterId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
            >
              <option value="">— Selecciona —</option>
              {dsmRasters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.captured_at ?? "—"})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Polígono GeoJSON (lng,lat)" required>
            <textarea
              value={polygonText}
              onChange={(e) => setPolygonText(e.target.value)}
              rows={5}
              placeholder='{"type":"Polygon","coordinates":[[[-70.5,-33.5],[-70.499,-33.5],[-70.499,-33.499],[-70.5,-33.499],[-70.5,-33.5]]]}'
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary font-mono text-[10px]"
            />
            <p className="text-[9px] text-muted-foreground mt-1">
              Pega un Polygon, Feature o FeatureCollection. Próximamente: dibujar directo en el
              mapa.
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Método del plano base">
              <select
                value={baseMethod}
                onChange={(e) => setBaseMethod(e.target.value as typeof baseMethod)}
                className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
              >
                <option value="edge_mean">Promedio del contorno</option>
                <option value="min">Mínimo dentro</option>
                <option value="fixed">Valor fijo</option>
              </select>
            </Field>
            {baseMethod === "fixed" && (
              <Field label="Elevación base (m)">
                <input
                  type="number"
                  step="0.01"
                  value={baseFixed}
                  onChange={(e) => setBaseFixed(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
                />
              </Field>
            )}
          </div>
          <Field label="Notas">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={running}
              className="px-3 py-1.5 rounded border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={running || dsmRasters.length === 0}
              className="px-3 py-1.5 rounded bg-gold text-bg-primary font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {running ? "Calculando…" : "Calcular volumen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase text-muted-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
