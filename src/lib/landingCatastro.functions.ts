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
      geom.type === "Polygon" ? (c as unknown[])[0] : ((c as unknown[])[0] as unknown[])?.[0];
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

// El catastro nacional se sincroniza en lotes; 1 h de desfase es aceptable y
// evita repetir conteos completos y lecturas de 15k filas en cada visita.
const SNAPSHOT_TTL_MS = 60 * 60 * 1000;

export const getLandingCatastroSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingCatastroSnapshot> => {
    const { memoize } = await import("@/lib/server/memoCache");
    return memoize("landing-catastro-snapshot", SNAPSHOT_TTL_MS, loadSnapshot);
  },
);

async function loadSnapshot(): Promise<LandingCatastroSnapshot> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const generatedAt = new Date().toISOString();

    const [totalRes, groupRes, sampleRes, syncRes] = await Promise.all([
      // Conteo estimado del planificador: evita recorrer la tabla completa.
      supabaseAdmin.from("cadastre_national").select("id", { count: "planned", head: true }),
      supabaseAdmin.from("cadastre_national").select("tipo,status,holder_name").limit(15000),
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

    const tipoMap = new Map<string, number>();
    const estadoMap = new Map<string, number>();
    const holderMap = new Map<string, number>();
    for (const r of (groupRes.data ?? []) as Array<{
      tipo: string | null;
      status: string | null;
      holder_name: string | null;
    }>) {
      if (r.tipo) tipoMap.set(r.tipo, (tipoMap.get(r.tipo) ?? 0) + 1);
      if (r.status) estadoMap.set(r.status, (estadoMap.get(r.status) ?? 0) + 1);
      if (r.holder_name) holderMap.set(r.holder_name, (holderMap.get(r.holder_name) ?? 0) + 1);
    }
    const toArr = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
    const porTipo = toArr(tipoMap).slice(0, 6);
    const porEstado = toArr(estadoMap).slice(0, 6);
    const topTitulares = toArr(holderMap)
      .slice(0, 6)
      .map((x) => ({ name: x.key, count: x.count }));

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
