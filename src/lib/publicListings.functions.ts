// Server fn pública: lista property_listings publicados con campos seguros
// (sin owner_user_id ni datos sensibles). Usada por /inversionistas.
import { createServerFn } from "@tanstack/react-start";

export type PublicListing = {
  id: string;
  title: string;
  code: string | null;
  commodity: string | null;
  country: string | null;
  region: string | null;
  area_ha: number | null;
  stage: string | null;
  modality: string | null;
  asking_price_usd: number | null;
  royalty_pct: number | null;
  summary: string | null;
  cover_image_url: string | null;
  data_available: string[] | null;
  views_count: number;
  is_featured: boolean;
  has_geometry: boolean;
  centroid: [number, number] | null;
};

const REGION_CENTROID: Record<string, [number, number]> = {
  "Arica y Parinacota": [-69.59, -18.48],
  Tarapacá: [-69.6, -20.2],
  Antofagasta: [-69.0, -23.65],
  Atacama: [-69.9, -27.5],
  Coquimbo: [-70.95, -30.5],
  Valparaíso: [-71.5, -32.8],
  Metropolitana: [-70.65, -33.45],
  "O'Higgins": [-70.95, -34.55],
  Maule: [-71.4, -35.5],
  Ñuble: [-71.8, -36.6],
  Biobío: [-72.6, -37.0],
  Araucanía: [-72.4, -38.7],
  "Los Ríos": [-72.9, -39.85],
  "Los Lagos": [-72.7, -41.5],
  Aysén: [-72.0, -45.5],
  Magallanes: [-71.0, -53.0],
};

function centroidOf(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown };
  try {
    if (g.type === "Point" && Array.isArray(g.coordinates)) {
      return [Number(g.coordinates[0]), Number(g.coordinates[1])];
    }
    // Walk and average
    let sx = 0,
      sy = 0,
      n = 0;
    const walk = (c: unknown) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number") {
        sx += c[0];
        sy += c[1];
        n++;
      } else {
        for (const x of c) walk(x);
      }
    };
    walk(g.coordinates);
    if (n === 0) return null;
    return [sx / n, sy / n];
  } catch {
    return null;
  }
}

export const getPublicListings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ listings: PublicListing[]; updatedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data, error } = await supabaseAdmin
        .from("property_listings")
        .select(
          "id,title,code,commodity,country,region,area_ha,stage,modality,asking_price_usd,royalty_pct,summary,cover_image_url,data_available,views_count,is_featured,geometry_geojson,projects:projects(center_lat,center_lng)",
        )
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        console.error("[publicListings] query error", error);
        return { listings: [], updatedAt: new Date().toISOString() };
      }

      const listings: PublicListing[] = (data ?? []).map((r) => {
        let centroid = centroidOf(
          typeof r.geometry_geojson === "string"
            ? safeParse(r.geometry_geojson)
            : r.geometry_geojson,
        );
        if (!centroid) {
          const pc = r.projects as unknown as {
            center_lat: number | null;
            center_lng: number | null;
          } | null;
          if (pc?.center_lat != null && pc?.center_lng != null) {
            centroid = [Number(pc.center_lng), Number(pc.center_lat)];
          } else if (r.region && REGION_CENTROID[r.region]) {
            centroid = REGION_CENTROID[r.region];
          }
        }
        return {
          id: r.id,
          title: r.title,
          code: r.code ?? null,
          commodity: r.commodity ?? null,
          country: r.country ?? null,
          region: r.region ?? null,
          area_ha: r.area_ha != null ? Number(r.area_ha) : null,
          stage: r.stage ?? null,
          modality: r.modality ?? null,
          asking_price_usd: r.asking_price_usd != null ? Number(r.asking_price_usd) : null,
          royalty_pct: r.royalty_pct != null ? Number(r.royalty_pct) : null,
          summary: r.summary ?? null,
          cover_image_url: r.cover_image_url ?? null,
          data_available: r.data_available ?? null,
          views_count: r.views_count ?? 0,
          is_featured: !!r.is_featured,
          has_geometry: !!r.geometry_geojson,
          centroid,
        };
      });

      return { listings, updatedAt: new Date().toISOString() };
    } catch (e) {
      console.error("[publicListings] handler crash", e);
      return { listings: [], updatedAt: new Date().toISOString() };
    }
  },
);

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
