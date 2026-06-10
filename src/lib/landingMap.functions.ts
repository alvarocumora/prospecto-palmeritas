// Server functions públicas para el mapa del landing.
// Sin requireSupabaseAuth: corren durante SSR y para visitantes anónimos.
import { createServerFn } from "@tanstack/react-start";

type FC = { type: "FeatureCollection"; features: any[] };
type GeoPayload = {
  concessions: FC;
  anomalies: FC;
  deposits: FC;
  targets: FC;
  listings: FC;
  bbox: [number, number, number, number] | null;
  listingsBbox: [number, number, number, number] | null;
  generatedAt: string;
};

const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

// Centroides aproximados por región (fallback cuando no hay project center).
const REGION_CENTROID: Record<string, [number, number]> = {
  "Arica y Parinacota": [-69.59, -18.48],
  "Tarapacá": [-69.6, -20.2],
  "Antofagasta": [-69.0, -23.65],
  "Atacama": [-69.9, -27.5],
  "Coquimbo": [-70.95, -30.5],
  "Valparaíso": [-71.5, -32.8],
  "Metropolitana": [-70.65, -33.45],
  "O'Higgins": [-70.95, -34.55],
  "Maule": [-71.4, -35.5],
  "Ñuble": [-71.8, -36.6],
  "Biobío": [-72.6, -37.0],
  "Araucanía": [-72.4, -38.7],
  "Los Ríos": [-72.9, -39.85],
  "Los Lagos": [-72.7, -41.5],
  "Aysén": [-72.0, -45.5],
  "Magallanes": [-71.0, -53.0],
};

function jitter(lng: number, lat: number, seed: string): [number, number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = ((h & 0xffff) / 0xffff - 0.5) * 0.6; // ~±0.3°
  const b = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 0.6;
  return [lng + a, lat + b];
}

function bboxFromFC(fc: FC): [number, number, number, number] | null {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  const walk = (c: any) => {
    if (typeof c?.[0] === "number") {
      if (c[0] < mnx) mnx = c[0];
      if (c[0] > mxx) mxx = c[0];
      if (c[1] < mny) mny = c[1];
      if (c[1] > mxy) mxy = c[1];
    } else if (Array.isArray(c)) for (const x of c) walk(x);
  };
  for (const f of fc.features) if (f?.geometry && "coordinates" in f.geometry) walk((f.geometry as any).coordinates);
  if (!isFinite(mnx)) return null;
  return [mnx, mny, mxx, mxy];
}

export const getLandingMapData = createServerFn({ method: "GET" }).handler(
  async (): Promise<GeoPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Listings publicados (modo "Listados / DB") ---
    let listings: FC = EMPTY_FC;
    try {
      const { data: rows } = await supabaseAdmin
        .from("property_listings")
        .select(
          "id, title, commodity, region, country, area_ha, asking_price_usd, stage, modality, cover_image_url, geometry_geojson, project_id, projects:projects(center_lat,center_lng)",
        )
        .eq("is_published", true)
        .limit(200);

      const feats = (rows ?? []).flatMap((r: any) => {
        let geom: any = null;
        // Prefer explicit geometry; else point from project center; else region centroid.
        if (r.geometry_geojson) {
          geom =
            typeof r.geometry_geojson === "string"
              ? safeParse(r.geometry_geojson)
              : r.geometry_geojson;
        }
        if (!geom) {
          const pc = r.projects;
          let lng: number | null = null;
          let lat: number | null = null;
          if (pc?.center_lat != null && pc?.center_lng != null) {
            lng = Number(pc.center_lng);
            lat = Number(pc.center_lat);
          } else if (r.region && REGION_CENTROID[r.region]) {
            [lng, lat] = REGION_CENTROID[r.region];
          }
          if (lng == null || lat == null) return [];
          const [jx, jy] = jitter(lng, lat, String(r.id));
          geom = { type: "Point", coordinates: [jx, jy] };
        }
        return [
          {
            type: "Feature",
            id: r.id,
            geometry: geom,
            properties: {
              id: r.id,
              title: r.title,
              commodity: r.commodity,
              region: r.region,
              country: r.country,
              area_ha: r.area_ha,
              asking_price_usd: r.asking_price_usd,
              stage: r.stage,
              modality: r.modality,
              cover_image_url: r.cover_image_url,
            },
          },
        ];
      });
      listings = { type: "FeatureCollection", features: feats };
    } catch (_e) {
      listings = EMPTY_FC;
    }

    // --- Potencial (modo geoespacial) ---
    let concessions = EMPTY_FC;
    let anomalies = EMPTY_FC;
    let deposits = EMPTY_FC;
    let targets = EMPTY_FC;
    let bbox: [number, number, number, number] | null = null;
    try {
      const { data, error } = await supabaseAdmin.rpc("opportunities_geo", {
        _limit: 60,
        _min_score: 40,
        _region: null as unknown as string,
      });
      if (error) throw error;
      const payload = (data ?? {}) as any;
      concessions = (payload.concessions as FC) ?? EMPTY_FC;
      anomalies = (payload.anomalies as FC) ?? EMPTY_FC;
      deposits = (payload.deposits as FC) ?? EMPTY_FC;
      targets = (payload.targets as FC) ?? EMPTY_FC;
      bbox = (payload.bbox as [number, number, number, number]) ?? null;
    } catch (_e) {
      /* ignore */
    }

    return {
      concessions,
      anomalies,
      deposits,
      targets,
      listings,
      bbox,
      listingsBbox: bboxFromFC(listings),
      generatedAt: new Date().toISOString(),
    };
  },
);

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
