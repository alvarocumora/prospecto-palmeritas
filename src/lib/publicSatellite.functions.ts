import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { centroidOf } from "@/lib/geo";
import { DEMO_PROJECT_IDS } from "@/lib/verification";

export type PublicSatProject = {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  commodity: string | null;
  center_lat: number | null;
  center_lng: number | null;
  cover_image_url: string | null;
  listing_id: string | null;
  anomalies: Array<{
    id: string;
    index_code: string | null;
    severity: string | null;
    score: number | null;
    area_ha: number | null;
    detected_at: string | null;
    notes: string | null;
    lng: number | null;
    lat: number | null;
  }>;
  insar: Array<{
    id: string;
    asset_name: string | null;
    source: string | null;
    reference_date: string | null;
    end_date: string | null;
    velocity_mm_year: number | null;
    cumulative_displacement_mm: number | null;
    coherence: number | null;
    alert_severity: string | null;
  }>;
  drillholes: Array<{
    id: string;
    hole_id: string;
    easting: number | null;
    northing: number | null;
    elevation: number | null;
    azimuth: number | null;
    dip: number | null;
    depth: number | null;
    status: string;
    intervals: Array<{
      from: number;
      to: number;
      lithology: string | null;
      au_gpt: number | null;
      ag_gpt: number | null;
      cu_pct: number | null;
    }>;
  }>;
};

// Proyectos demo siempre visibles aunque no tengan listado publicado.
// La lista canónica vive en verification.ts (misma que alimenta los sellos).
const DEMO_IDS = DEMO_PROJECT_IDS;

const MAX_PROJECTS = 12;
const MAX_HOLES_PER_PROJECT = 30;

export const getPublicSatellite = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSatProject[]> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    // Proyectos visibles = demo IDs ∪ proyectos con listado publicado
    const { data: listings } = await supabase
      .from("property_listings")
      .select("id, project_id")
      .eq("is_published", true)
      .not("project_id", "is", null);

    const listingByProject = new Map<string, string>();
    for (const l of listings ?? []) {
      if (l.project_id && !listingByProject.has(l.project_id)) {
        listingByProject.set(l.project_id, l.id);
      }
    }

    const projectIds = Array.from(new Set([...DEMO_IDS, ...listingByProject.keys()])).slice(
      0,
      MAX_PROJECTS,
    );

    const [{ data: projects }, { data: anomalies }, { data: insar }, { data: holes }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id, name, country, region, commodity, center_lat, center_lng, cover_image_url")
          .in("id", projectIds),
        supabase
          .from("satellite_anomalies")
          .select(
            "id, project_id, index_code, severity, score, area_ha, detected_at, notes, geometry",
          )
          .in("project_id", projectIds)
          .order("detected_at", { ascending: false })
          .limit(500),
        supabase
          .from("insar_displacement")
          .select(
            "id, project_id, asset_name, source, reference_date, end_date, velocity_mm_year, cumulative_displacement_mm, coherence, alert_severity",
          )
          .in("project_id", projectIds)
          .order("reference_date", { ascending: false })
          .limit(500),
        supabase
          .from("drill_holes")
          .select(
            "id, project_id, hole_id, easting, northing, elevation, azimuth, dip, actual_depth, planned_depth, status",
          )
          .in("project_id", projectIds)
          .order("created_at", { ascending: true })
          .limit(400),
      ]);

    // Intervalos de litología/leyes para los sondajes visibles (cap por hole)
    const cappedHoleIds = projectIds
      .flatMap((pid) =>
        (holes ?? [])
          .filter((h) => h.project_id === pid)
          .slice(0, MAX_HOLES_PER_PROJECT)
          .map((h) => h.id),
      )
      .slice(0, 150);

    const { data: coreLogs } = cappedHoleIds.length
      ? await supabase
          .from("drill_core_logs")
          .select("hole_id, depth_from, depth_to, lithology, au_gpt, ag_gpt, cu_pct")
          .in("hole_id", cappedHoleIds)
          .order("depth_from", { ascending: true })
          .limit(1500)
      : { data: [] as never[] };

    const intervalsByHole = new Map<
      string,
      Array<{
        from: number;
        to: number;
        lithology: string | null;
        au_gpt: number | null;
        ag_gpt: number | null;
        cu_pct: number | null;
      }>
    >();
    for (const log of coreLogs ?? []) {
      const arr = intervalsByHole.get(log.hole_id) ?? [];
      if (arr.length < 24) {
        arr.push({
          from: Number(log.depth_from),
          to: Number(log.depth_to),
          lithology: log.lithology,
          au_gpt: log.au_gpt != null ? Number(log.au_gpt) : null,
          ag_gpt: log.ag_gpt != null ? Number(log.ag_gpt) : null,
          cu_pct: log.cu_pct != null ? Number(log.cu_pct) : null,
        });
      }
      intervalsByHole.set(log.hole_id, arr);
    }

    // Solo proyectos con al menos algo que mostrar (anomalías, InSAR o sondajes),
    // demo IDs siempre incluidos.
    const hasData = (pid: string) =>
      DEMO_IDS.includes(pid) ||
      (anomalies ?? []).some((a) => a.project_id === pid) ||
      (insar ?? []).some((i) => i.project_id === pid) ||
      (holes ?? []).some((h) => h.project_id === pid);

    return (projects ?? [])
      .filter((p) => hasData(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        country: p.country,
        region: p.region,
        commodity: p.commodity,
        center_lat: p.center_lat,
        center_lng: p.center_lng,
        cover_image_url: p.cover_image_url,
        listing_id: listingByProject.get(p.id) ?? null,
        anomalies: (anomalies ?? [])
          .filter((a) => a.project_id === p.id)
          .map(({ project_id: _pid, geometry, ...rest }) => {
            const c = centroidOf(geometry);
            return { ...rest, lng: c?.[0] ?? null, lat: c?.[1] ?? null };
          }),
        insar: (insar ?? [])
          .filter((i) => i.project_id === p.id)
          .map(({ project_id: _pid, ...rest }) => rest),
        drillholes: (holes ?? [])
          .filter((h) => h.project_id === p.id)
          .slice(0, MAX_HOLES_PER_PROJECT)
          .map((h) => ({
            id: h.id,
            hole_id: h.hole_id,
            easting: h.easting,
            northing: h.northing,
            elevation: h.elevation,
            azimuth: h.azimuth,
            dip: h.dip,
            depth: h.actual_depth ?? h.planned_depth,
            status: h.status,
            intervals: intervalsByHole.get(h.id) ?? [],
          })),
      }));
  },
);
