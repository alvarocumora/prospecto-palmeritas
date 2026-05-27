// Server functions públicas para vetas y plan minero de Los Verdes.
// RLS bypass intencional (admin client) acotado por project_id; solo se exponen
// columnas seguras de un proyecto específicamente marcado como público.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  cubicateVein,
  cubicatePhase,
  lineLengthM,
  type Cubication,
  type PhaseCubication,
  type LngLat,
} from "@/lib/mining-calc";

const LOSVERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type VeinPublic = {
  id: string;
  code: string;
  name: string;
  commodity: string | null;
  strike_deg: number | null;
  dip_deg: number | null;
  dip_dir_deg: number | null;
  thickness_m: number | null;
  length_m: number | null;
  depth_top_m: number | null;
  depth_bottom_m: number | null;
  grade_estimate: Record<string, number> | null;
  density_tm3: number | null;
  confidence: string | null;
  geometry: { type: "LineString"; coordinates: LngLat[] } | null;
  notes: string | null;
  /** Cubicación tonelaje + metal contenido + revenue conceptual. */
  cubication: Cubication | null;
};

export type MinePlanPhasePublic = {
  id: string;
  phase_no: number;
  name: string;
  method: string | null;
  target_id: string | null;
  avg_thickness_m: number | null;
  density_tm3: number | null;
  recovery_pct: number | null;
  capex_usd: number | null;
  opex_usd_t: number | null;
  metal_price_assumption: Record<string, number> | null;
  grade_estimate: Record<string, number> | null;
  start_year: number | null;
  duration_years: number | null;
  area_polygon: { type: "Polygon"; coordinates: LngLat[][] } | null;
  notes: string | null;
  cubication: PhaseCubication | null;
};

export type LosVerdesMining = {
  veins: VeinPublic[];
  phases: MinePlanPhasePublic[];
  totals: {
    veinTonnes: number;
    veinRevenueUsd: number;
    phaseTonnes: number;
    phaseRevenueUsd: number;
    npvUsdTotal: number;
    capexUsdTotal: number;
  };
};

export const getLosVerdesMining = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdesMining> => {
    const [vRes, pRes] = await Promise.all([
      supabaseAdmin
        .from("veins")
        .select(
          "id, code, name, commodity, strike_deg, dip_deg, dip_dir_deg, thickness_m, length_m, depth_top_m, depth_bottom_m, grade_estimate, density_tm3, confidence, geometry, notes",
        )
        .eq("project_id", LOSVERDES_PROJECT_ID)
        .order("code", { ascending: true }),
      supabaseAdmin
        .from("mine_plan_phases")
        .select(
          "id, phase_no, name, method, target_id, avg_thickness_m, density_tm3, recovery_pct, capex_usd, opex_usd_t, metal_price_assumption, grade_estimate, start_year, duration_years, area_polygon, notes",
        )
        .eq("project_id", LOSVERDES_PROJECT_ID)
        .order("phase_no", { ascending: true }),
    ]);
    if (vRes.error) throw new Error(vRes.error.message);
    if (pRes.error) throw new Error(pRes.error.message);

    // Precios y recovery por defecto si no hay assumption
    const defaultPrices = { cu_usd_lb: 4.2, au_usd_oz: 2200, ag_usd_oz: 26 };

    const veins: VeinPublic[] = (vRes.data ?? []).map((row) => {
      const geom = row.geometry as VeinPublic["geometry"];
      // Si no hay length_m en DB usamos la longitud geométrica
      let length = Number(row.length_m ?? 0);
      if (!length && geom?.coordinates) length = lineLengthM(geom.coordinates);
      const grade = (row.grade_estimate ?? {}) as Record<string, number>;
      const density = Number(row.density_tm3 ?? 2.7);
      const cubication =
        length > 0 &&
        Number(row.thickness_m ?? 0) > 0 &&
        Number(row.depth_bottom_m ?? 0) > 0
          ? cubicateVein({
              length_m: length,
              thickness_m: Number(row.thickness_m ?? 0),
              depth_top_m: Number(row.depth_top_m ?? 0),
              depth_bottom_m: Number(row.depth_bottom_m ?? 0),
              dip_deg: Number(row.dip_deg ?? 75),
              density_tm3: density,
              grade,
              prices: defaultPrices,
              recovery_pct: 80,
            })
          : null;
      return {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        commodity: row.commodity as string | null,
        strike_deg: row.strike_deg as number | null,
        dip_deg: row.dip_deg as number | null,
        dip_dir_deg: row.dip_dir_deg as number | null,
        thickness_m: row.thickness_m as number | null,
        length_m: row.length_m as number | null,
        depth_top_m: row.depth_top_m as number | null,
        depth_bottom_m: row.depth_bottom_m as number | null,
        grade_estimate: grade,
        density_tm3: density,
        confidence: row.confidence as string | null,
        geometry: geom,
        notes: row.notes as string | null,
        cubication,
      };
    });

    const phases: MinePlanPhasePublic[] = (pRes.data ?? []).map((row) => {
      const poly = row.area_polygon as MinePlanPhasePublic["area_polygon"];
      const ring = poly?.coordinates?.[0] ?? null;
      const grade = (row.grade_estimate ?? {}) as Record<string, number>;
      const prices = (row.metal_price_assumption ?? defaultPrices) as Record<
        string,
        number
      >;
      const cubication =
        ring && ring.length >= 3
          ? cubicatePhase({
              polygon: ring,
              avg_thickness_m: Number(row.avg_thickness_m ?? 0),
              density_tm3: Number(row.density_tm3 ?? 2.7),
              grade,
              recovery_pct: Number(row.recovery_pct ?? 80),
              capex_usd: Number(row.capex_usd ?? 0),
              opex_usd_t: Number(row.opex_usd_t ?? 0),
              prices,
              start_year: Number(row.start_year ?? 1),
              duration_years: Number(row.duration_years ?? 3),
              discount_rate: 0.08,
            })
          : null;
      return {
        id: String(row.id),
        phase_no: Number(row.phase_no),
        name: String(row.name),
        method: row.method as string | null,
        target_id: row.target_id as string | null,
        avg_thickness_m: row.avg_thickness_m as number | null,
        density_tm3: row.density_tm3 as number | null,
        recovery_pct: row.recovery_pct as number | null,
        capex_usd: row.capex_usd as number | null,
        opex_usd_t: row.opex_usd_t as number | null,
        metal_price_assumption: prices,
        grade_estimate: grade,
        start_year: row.start_year as number | null,
        duration_years: row.duration_years as number | null,
        area_polygon: poly,
        notes: row.notes as string | null,
        cubication,
      };
    });

    const totals = {
      veinTonnes: veins.reduce((s, v) => s + (v.cubication?.tonnes ?? 0), 0),
      veinRevenueUsd: veins.reduce((s, v) => s + (v.cubication?.revenueUsd ?? 0), 0),
      phaseTonnes: phases.reduce((s, p) => s + (p.cubication?.tonnes ?? 0), 0),
      phaseRevenueUsd: phases.reduce((s, p) => s + (p.cubication?.revenueUsd ?? 0), 0),
      npvUsdTotal: phases.reduce((s, p) => s + (p.cubication?.npvUsd ?? 0), 0),
      capexUsdTotal: phases.reduce((s, p) => s + Number(p.capex_usd ?? 0), 0),
    };

    return { veins, phases, totals };
  },
);
