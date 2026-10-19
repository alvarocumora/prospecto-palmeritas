import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { supabase } from "@/integrations/supabase/client";
import { satelliteEvidence } from "@/lib/satellite/evidence";
import { geoColors } from "@/lib/geospatial/visualTokens";

export type HyperRow = {
  metadata?: unknown;
  id: string;
  source: string | null;
  mineral: string | null;
  assemblage: string | null;
  bbox_geojson: Geometry | null;
  mean_score: number | null;
  max_score: number | null;
  acquisition_date: string | null;
};

export type InsarRow = {
  metadata?: unknown;
  id: string;
  asset_name: string | null;
  asset_type: string | null;
  point_geojson: Geometry | null;
  velocity_mm_year: number | null;
  cumulative_displacement_mm: number | null;
  coherence: number | null;
  alert_severity: string | null;
  end_date: string | null;
};

export type StockRow = {
  notes?: string | null;
  id: string;
  name: string;
  material: string | null;
  polygon_geojson: Geometry | null;
  volume_m3: number | null;
  area_m2: number | null;
  mean_height_m: number | null;
};

export type HotspotRow = {
  id: string;
  index_code: string | null;
  geometry: Geometry | null;
  severity: string | null;
  score: number | null;
  area_ha: number | null;
  detected_at: string | null;
  notes: string | null;
};

export type SatelliteLayerKey =
  "aoi" | "hyper_emit" | "hyper_aster" | "insar" | "demdiff" | "hotspots_high";

export type SatelliteContextLayer = {
  id: SatelliteLayerKey;
  label: string;
  evidence: string;
  evidenceForFeature?: (properties: Record<string, unknown>) => string;
  features: FeatureCollection;
  color?: string | ((properties: Record<string, unknown>) => string);
};

export const SATELLITE_LAYER_LABELS: Record<SatelliteLayerKey, string> = {
  aoi: "AOI proyecto",
  hyper_emit: "EMIT (60 m)",
  hyper_aster: "ASTER (30 m)",
  insar: "InSAR velocity (mm/a)",
  demdiff: "DEM-diff stockpiles",
  hotspots_high: "Hotspots HIGH (sat)",
};

const SATELLITE_LAYER_COLORS: Record<SatelliteLayerKey, string> = {
  aoi: geoColors.signal,
  hyper_emit: geoColors.pendingEvidence,
  hyper_aster: geoColors.hydrothermal,
  insar: geoColors.signal,
  demdiff: geoColors.sample,
  hotspots_high: geoColors.neighbourDeposit,
};

/** Rampa industrial para velocidad InSAR (mm/año). */
export function velocityColor(v: number | null): string {
  if (v == null) return geoColors.declared;
  const a = Math.abs(v);
  if (a >= 25) return geoColors.deposit; // red
  if (a >= 15) return geoColors.tenureOwn; // amber
  if (a >= 8) return geoColors.structure; // yellow
  if (a >= 3) return geoColors.signal; // cyan
  return geoColors.sample; // green
}

function bboxArea(g: Geometry | null | undefined): number {
  try {
    const c = g && "coordinates" in g ? (g.coordinates as unknown[])[0] : undefined;
    if (!Array.isArray(c)) return 0;
    const xs = c.map((p: number[]) => p[0]);
    const ys = c.map((p: number[]) => p[1]);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  } catch {
    return 0;
  }
}

/**
 * Capas de inteligencia satelital (EMIT/ASTER hiperespectral, InSAR,
 * DEM-diff stockpiles, hotspots) en el contrato `contextLayers` de
 * ProjectMasterViewer — antes solo vivían dentro de SatelliteMapViewer
 * (visor dedicado de /satellite-intel), así que ningún otro consumidor de
 * ProjectMasterViewer (terminal, workspace) las veía. Este hook las expone
 * para que cualquier consumidor las sume sin repetir las consultas.
 */
export function useSatelliteContextLayers(projectId: string) {
  const [hyperData, setHyperData] = useState<HyperRow[]>([]);
  const [insarData, setInsarData] = useState<InsarRow[]>([]);
  const [stockData, setStockData] = useState<StockRow[]>([]);
  const [hotspots, setHotspots] = useState<HotspotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [h, i, s, hs] = await Promise.all([
        supabase
          .from("hyperspectral_products")
          .select(
            "id,source,mineral,assemblage,bbox_geojson,mean_score,max_score,acquisition_date,metadata",
          )
          .eq("project_id", projectId),
        supabase
          .from("insar_displacement")
          .select(
            "id,asset_name,asset_type,point_geojson,velocity_mm_year,cumulative_displacement_mm,coherence,alert_severity,end_date,metadata",
          )
          .eq("project_id", projectId),
        supabase
          .from("stockpile_volumes")
          .select("id,name,material,polygon_geojson,volume_m3,area_m2,mean_height_m,notes")
          .eq("project_id", projectId),
        supabase
          .from("satellite_anomalies")
          .select("id,index_code,geometry,severity,score,area_ha,detected_at,notes")
          .eq("project_id", projectId)
          .in("severity", ["high", "HIGH", "High", "critical", "Critical", "CRITICAL"]),
      ]);
      if (cancelled) return;
      setHyperData((h.data ?? []) as unknown as HyperRow[]);
      setInsarData((i.data ?? []) as unknown as InsarRow[]);
      setStockData((s.data ?? []) as unknown as StockRow[]);
      setHotspots((hs.data ?? []) as unknown as HotspotRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const layers = useMemo<SatelliteContextLayer[]>(() => {
    const result: SatelliteContextLayer[] = [];
    const add = (
      id: SatelliteLayerKey,
      features: FeatureCollection["features"],
      color?: string | ((properties: Record<string, unknown>) => string),
    ) => {
      result.push({
        id,
        label: SATELLITE_LAYER_LABELS[id],
        evidence: "DERIVADO",
        evidenceForFeature: (properties) =>
          satelliteEvidence(
            properties.metadata,
            typeof properties.notes === "string" ? properties.notes : null,
          ),
        features: { type: "FeatureCollection", features },
        color: color ?? SATELLITE_LAYER_COLORS[id],
      });
    };
    const footprint = hyperData
      .map((p) => p.bbox_geojson)
      .filter((g): g is Geometry => !!g)
      .sort((a, b) => bboxArea(b) - bboxArea(a))[0];
    add(
      "aoi",
      footprint
        ? [
            {
              type: "Feature",
              geometry: footprint,
              properties: { source: "Mayor huella hiperespectral; no delimita tenencia" },
            },
          ]
        : [],
    );
    for (const [id, source] of [
      ["hyper_emit", "EMIT"],
      ["hyper_aster", "ASTER"],
    ] as const)
      add(
        id,
        hyperData
          .filter((p) => (source === "EMIT" ? p.source === "EMIT" : p.source !== "EMIT"))
          .flatMap((p) =>
            p.bbox_geojson
              ? [{ type: "Feature", id: p.id, geometry: p.bbox_geojson, properties: { ...p } }]
              : [],
          ),
      );
    add(
      "insar",
      insarData.flatMap((p) =>
        p.point_geojson
          ? [{ type: "Feature", id: p.id, geometry: p.point_geojson, properties: { ...p } }]
          : [],
      ),
      (p) => velocityColor(typeof p.velocity_mm_year === "number" ? p.velocity_mm_year : null),
    );
    add(
      "demdiff",
      stockData.flatMap((p) =>
        p.polygon_geojson
          ? [{ type: "Feature", id: p.id, geometry: p.polygon_geojson, properties: { ...p } }]
          : [],
      ),
    );
    add(
      "hotspots_high",
      hotspots.flatMap((p) =>
        p.geometry
          ? [{ type: "Feature", id: p.id, geometry: p.geometry, properties: { ...p } }]
          : [],
      ),
    );
    return result;
  }, [hyperData, insarData, stockData, hotspots]);

  return {
    layers,
    loading,
    counts: {
      hyper: hyperData.length,
      insar: insarData.length,
      stock: stockData.length,
      hotspots: hotspots.length,
    },
  };
}
