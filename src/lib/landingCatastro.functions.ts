// Server function pública para snapshot real del catastro nacional en el landing.
// Sin auth: se ejecuta en SSR y para visitantes anónimos.
import { createServerFn } from "@tanstack/react-start";

export type LandingCatastroSnapshot = {
  totalNacional: number;
  porTipo: Array<{ key: string; count: number }>;
  porEstado: Array<{ key: string; count: number }>;
  topTitulares: Array<{ name: string; count: number }>;
  heatPoints: Array<[number, number]>;
  sampleSize: number;
  updatedAt: string | null;
  generatedAt: string;
};

function pointFromGeoJSON(g: unknown): [number, number] | null {
  if (!g || typeof g !== "object") return null;
  const geom = g as { type?: string; coordinates?: unknown };
  const c = geom.coordinates as unknown;
  if (!Array.isArray(c)) return null;
  // Polygon: [[[lng,lat],...]] — first ring, average of unique vertices for a rough centroid.
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    const ring =
      geom.type === "Polygon"
        ? (c as unknown[])[0]
        : ((c as unknown[])[0] as unknown[])?.[0];
    if (!Array.isArray(ring) || ring.length === 0) return null;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const v of ring) {
      if (Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number") {
        sx += v[0] as number;
        sy += v[1] as number;
        n++;
      }
    }
    if (n === 0) return null;
    return [sx / n, sy / n];
  }
  if (geom.type === "Point" && typeof c[0] === "number" && typeof c[1] === "number") {
    return [c[0] as number, c[1] as number];
  }
  return null;
}

export const getLandingCatastroSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingCatastroSnapshot> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const generatedAt = new Date().toISOString();

    const [totalRes, tipoRes, estadoRes, holdersRes, sampleRes, syncRes] = await Promise.all([
      supabaseAdmin.from("cadastre_national").select("id", { count: "exact", head: true }),
      supabaseAdmin.rpc("cadastre_group_count", { _column: "tipo" }).then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
      supabaseAdmin.rpc("cadastre_group_count", { _column: "status" }).then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
      supabaseAdmin.rpc("cadastre_top_holders", { _limit: 6 }).then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
      supabaseAdmin
        .from("cadastre_national")
        .select("geometry_geojson")
        .not("geometry_geojson", "is", null)
        .limit(3000),
      supabaseAdmin
        .from("cadastre_sync_runs")
        .select("finished_at")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1),
    ]);

    // Fallback: si los RPC no existen, agrupamos client-side pidiendo columnas.
    let porTipo = ((tipoRes as { data: unknown }).data as Array<{ key: string; count: number }>) ?? [];
    let porEstado =
      ((estadoRes as { data: unknown }).data as Array<{ key: string; count: number }>) ?? [];
    let topTitulares =
      ((holdersRes as { data: unknown }).data as Array<{ name: string; count: number }>) ?? [];

    if (porTipo.length === 0 || porEstado.length === 0 || topTitulares.length === 0) {
      const { data: rows } = await supabaseAdmin
        .from("cadastre_national")
        .select("tipo,status,holder_name")
        .limit(15000);
      const tipoMap = new Map<string, number>();
      const estadoMap = new Map<string, number>();
      const holderMap = new Map<string, number>();
      for (const r of rows ?? []) {
        const rr = r as { tipo?: string | null; status?: string | null; holder_name?: string | null };
        if (rr.tipo) tipoMap.set(rr.tipo, (tipoMap.get(rr.tipo) ?? 0) + 1);
        if (rr.status) estadoMap.set(rr.status, (estadoMap.get(rr.status) ?? 0) + 1);
        if (rr.holder_name)
          holderMap.set(rr.holder_name, (holderMap.get(rr.holder_name) ?? 0) + 1);
      }
      const toArr = (m: Map<string, number>) =>
        Array.from(m.entries())
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count);
      if (porTipo.length === 0) porTipo = toArr(tipoMap);
      if (porEstado.length === 0) porEstado = toArr(estadoMap);
      if (topTitulares.length === 0)
        topTitulares = toArr(holderMap)
          .slice(0, 6)
          .map((x) => ({ name: x.key, count: x.count }));
    }

    const heatPoints: Array<[number, number]> = [];
    for (const row of (sampleRes.data ?? []) as Array<{ geometry_geojson: unknown }>) {
      const p = pointFromGeoJSON(row.geometry_geojson);
      if (p && p[0] > -80 && p[0] < -66 && p[1] > -56 && p[1] < -17) heatPoints.push(p);
    }

    const updatedAt =
      ((syncRes.data as Array<{ finished_at: string }> | null) ?? [])[0]?.finished_at ?? null;

    return {
      totalNacional: totalRes.count ?? 0,
      porTipo: porTipo.slice(0, 6),
      porEstado: porEstado.slice(0, 6),
      topTitulares: topTitulares.slice(0, 6),
      heatPoints,
      sampleSize: heatPoints.length,
      updatedAt,
      generatedAt,
    };
  },
);
