import { useState } from "react";
import { Download, Loader2, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFeatureCollection,
  downloadBlob,
  rowsToCsv,
  satelliteAnomaliesToFeatures,
  geophysicsAnomaliesToFeatures,
  geologicalFeaturesToFeatures,
  prospectivityCellsToFeatures,
} from "@/lib/geoExport";

interface Props {
  projectId: string | null;
  projectName?: string;
}

type DatasetKey = "satellite_anomalies" | "geophysics_anomalies" | "geological_features" | "prospectivity_cells";

const DATASETS: Array<{ key: DatasetKey; label: string }> = [
  { key: "satellite_anomalies", label: "Anomalías satelitales" },
  { key: "geophysics_anomalies", label: "Anomalías geofísicas" },
  { key: "geological_features", label: "Estructuras geológicas" },
  { key: "prospectivity_cells", label: "Celdas de prospectividad" },
];

export function Ni43101GeoExport({ projectId, projectName }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!projectId) return null;
  const pid: string = projectId;

  const slug = (projectName ?? "proyecto").replace(/\s+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);

  async function fetchDataset(key: DatasetKey) {
    if (key === "satellite_anomalies") {
      const { data, error } = await supabase
        .from("satellite_anomalies")
        .select("id, project_id, run_id, index_code, geometry, bbox, severity, score, area_ha, notes, detected_at")
        .eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    }
    if (key === "geophysics_anomalies") {
      const { data, error } = await supabase
        .from("geophysics_anomalies")
        .select("id, code, anomaly_type, severity, status, confidence_pct, lat, lng, peak_value, peak_unit, estimated_depth_m, estimated_area_m2, rationale")
        .eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    }
    if (key === "geological_features") {
      const { data, error } = await supabase
        .from("geological_features")
        .select("id, feature_code, name, feature_type, strike, dip, length_m, width_m, description, geometry_geojson, source")
        .eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    }
    const { data, error } = await supabase
      .from("prospectivity_cells")
      .select("id, run_id, cell_lat, cell_lng, cell_size_m, score, features, generated_at")
      .eq("project_id", projectId);
    if (error) throw error;
    return data ?? [];
  }

  async function exportDataset(key: DatasetKey, format: "geojson" | "csv") {
    const tag = `${key}.${format}`;
    setBusy(tag);
    try {
      const rows = await fetchDataset(key);
      if (!rows.length) {
        toast.warning("Sin datos para exportar");
        return;
      }
      const filenameBase = `${slug}_${key}_${stamp}`;
      if (format === "csv") {
        const flat = rows.map((r: any) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) {
            out[k] = v && typeof v === "object" ? JSON.stringify(v) : v;
          }
          return out;
        });
        downloadBlob(rowsToCsv(flat), `${filenameBase}.csv`, "text/csv");
      } else {
        let features;
        if (key === "satellite_anomalies") features = satelliteAnomaliesToFeatures(rows);
        else if (key === "geophysics_anomalies") features = geophysicsAnomaliesToFeatures(rows);
        else if (key === "geological_features") features = geologicalFeaturesToFeatures(rows);
        else features = prospectivityCellsToFeatures(rows);
        const fc = buildFeatureCollection(key, features);
        downloadBlob(JSON.stringify(fc, null, 2), `${filenameBase}.geojson`, "application/geo+json");
      }
      toast.success(`Exportado ${rows.length} registros`);
    } catch (e) {
      console.error(e);
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-border bg-bg-tertiary/40 px-5 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Download className="w-3.5 h-3.5 text-gold" />
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
          Anexos exportables (NI 43-101)
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {DATASETS.map((d) => (
          <div
            key={d.key}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-border bg-bg-secondary"
          >
            <span className="text-[11px] font-mono text-foreground">{d.label}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportDataset(d.key, "geojson")}
                disabled={busy !== null}
                className="text-[10px] font-mono px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-40 inline-flex items-center gap-1"
                title="Exportar GeoJSON"
              >
                {busy === `${d.key}.geojson`
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <FileJson className="w-3 h-3" />}
                GeoJSON
              </button>
              <button
                onClick={() => exportDataset(d.key, "csv")}
                disabled={busy !== null}
                className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:border-gold/40 disabled:opacity-40 inline-flex items-center gap-1"
                title="Exportar CSV"
              >
                {busy === `${d.key}.csv`
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <FileSpreadsheet className="w-3 h-3" />}
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
