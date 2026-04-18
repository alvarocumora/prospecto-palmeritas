import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MiningConcession = {
  id: string;
  project_id: string;
  created_by: string;
  code: string;
  name: string;
  concession_type: string; // exploracion | explotacion | pertenencia | manifestacion
  status: string; // vigente | en_tramite | vencida | cancelada
  holder: string | null;
  area_ha: number | null;
  granted_at: string | null;
  expires_at: string | null;
  region: string | null;
  commune: string | null;
  geometry_geojson: unknown | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpiryStatus = "expired" | "critical" | "warning" | "ok" | "none";

export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(expiresAt: string | null): ExpiryStatus {
  const d = daysUntilExpiry(expiresAt);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d < 30) return "critical";
  if (d < 90) return "warning";
  return "ok";
}

export const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired: "#dc2626",
  critical: "#ea580c",
  warning: "#f59e0b",
  ok: "#0d9488",
  none: "#6b7280",
};

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  expired: "Vencida",
  critical: "Crítico (<30d)",
  warning: "Por vencer (<90d)",
  ok: "Vigente",
  none: "Sin fecha",
};

/** Quick AOI intersection: bbox overlap between concession polygon and AOI polygon. */
export function intersectsAoiBbox(
  geom: unknown,
  aoiCoords: [number, number][] | null
): boolean {
  if (!geom || !aoiCoords || aoiCoords.length === 0) return false;
  const g = geom as { type?: string; coordinates?: unknown };
  if (!g.type || !g.coordinates) return false;
  const points: [number, number][] = [];
  const collectRing = (ring: unknown) => {
    if (!Array.isArray(ring)) return;
    for (const pt of ring) {
      if (Array.isArray(pt) && pt.length >= 2) points.push([pt[0] as number, pt[1] as number]);
    }
  };
  if (g.type === "Polygon") {
    for (const ring of g.coordinates as unknown[]) collectRing(ring);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates as unknown[]) {
      if (Array.isArray(poly)) for (const ring of poly) collectRing(ring);
    }
  } else return false;
  if (points.length === 0) return false;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const gMinLng = Math.min(...lngs), gMaxLng = Math.max(...lngs);
  const gMinLat = Math.min(...lats), gMaxLat = Math.max(...lats);
  const aLngs = aoiCoords.map((p) => p[0]);
  const aLats = aoiCoords.map((p) => p[1]);
  const aMinLng = Math.min(...aLngs), aMaxLng = Math.max(...aLngs);
  const aMinLat = Math.min(...aLats), aMaxLat = Math.max(...aLats);
  return !(gMaxLng < aMinLng || gMinLng > aMaxLng || gMaxLat < aMinLat || gMinLat > aMaxLat);
}

export function useMiningConcessions(projectId: string | null) {
  const [data, setData] = useState<MiningConcession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("mining_concessions")
      .select("*")
      .eq("project_id", projectId)
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (err) {
      setError(err.message);
      setData([]);
    } else {
      setData((rows ?? []) as unknown as MiningConcession[]);
      setError(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
