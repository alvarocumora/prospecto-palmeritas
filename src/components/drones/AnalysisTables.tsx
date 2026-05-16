// Sprint 6.4/6.5 — tablas de DEM diffs y stockpiles.
import { Trash2, GitCompareArrows, Boxes } from "lucide-react";
import type { DemDiff, StockpileVolume } from "@/hooks/useDroneAnalysis";
import type { DroneRaster } from "@/hooks/useDroneFlights";

export function DiffTable({
  diffs,
  rasters,
  onDelete,
}: {
  diffs: DemDiff[];
  rasters: DroneRaster[];
  onDelete: (id: string, name: string) => void;
}) {
  if (diffs.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-8 text-center text-sm font-mono text-muted-foreground">
        <GitCompareArrows className="w-6 h-6 mx-auto mb-2 opacity-50" />
        Sin comparaciones DSM. Crea una para detectar cambios entre vuelos.
      </div>
    );
  }
  const nameOf = (id: string) => rasters.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-muted-foreground uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Análisis</th>
            <th className="text-left px-3 py-2">Antes → Después</th>
            <th className="text-right px-3 py-2">Fill (m³)</th>
            <th className="text-right px-3 py-2">Cut (m³)</th>
            <th className="text-right px-3 py-2">Net (m³)</th>
            <th className="text-right px-3 py-2">Δ media (m)</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d) => (
            <tr key={d.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 font-semibold">
                <div>{d.name}</div>
                <div className="text-[9px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()} · {d.cells_analyzed ?? 0} celdas
                </div>
              </td>
              <td className="px-3 py-2 text-[10px] text-muted-foreground">
                {nameOf(d.raster_before_id)}
                <br />→ {nameOf(d.raster_after_id)}
              </td>
              <td className="px-3 py-2 text-right text-teal font-semibold">
                {d.fill_volume_m3?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right text-destructive font-semibold">
                {d.cut_volume_m3?.toLocaleString() ?? "—"}
              </td>
              <td
                className={`px-3 py-2 text-right font-bold ${(d.net_volume_m3 ?? 0) >= 0 ? "text-teal" : "text-destructive"}`}
              >
                {(d.net_volume_m3 ?? 0) >= 0 ? "+" : ""}
                {d.net_volume_m3?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {d.diff_mean_m?.toFixed(3) ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onDelete(d.id, d.name)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StockpileTable({
  stockpiles,
  rasters,
  onDelete,
}: {
  stockpiles: StockpileVolume[];
  rasters: DroneRaster[];
  onDelete: (id: string, name: string) => void;
}) {
  if (stockpiles.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-8 text-center text-sm font-mono text-muted-foreground">
        <Boxes className="w-6 h-6 mx-auto mb-2 opacity-50" />
        Sin volúmenes calculados. Define un polígono sobre un DSM para medir un acopio.
      </div>
    );
  }
  const nameOf = (id: string) => rasters.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-muted-foreground uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Stockpile</th>
            <th className="text-left px-3 py-2">DSM</th>
            <th className="text-left px-3 py-2">Base</th>
            <th className="text-right px-3 py-2">Volumen (m³)</th>
            <th className="text-right px-3 py-2">Área (m²)</th>
            <th className="text-right px-3 py-2">H media / max (m)</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {stockpiles.map((s) => (
            <tr key={s.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 font-semibold">
                <div>{s.name}</div>
                <div className="text-[9px] text-muted-foreground">
                  {s.material ?? "—"} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground text-[10px]">{nameOf(s.raster_id)}</td>
              <td className="px-3 py-2 text-muted-foreground text-[10px]">
                {s.base_method}
                <br />
                {s.base_elevation_m?.toFixed(2)} m
              </td>
              <td className="px-3 py-2 text-right font-bold text-gold">
                {s.volume_m3?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {s.area_m2?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {s.mean_height_m?.toFixed(2) ?? "—"} / {s.max_height_m?.toFixed(2) ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onDelete(s.id, s.name)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
