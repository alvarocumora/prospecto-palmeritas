// Server function: snapshot consolidado para informe Los Verdes 5 — 3 frentes
// (La Guanaca, Los Verdes, Castellana). Asocia anomalías / vetas / fases
// vía bounding box a cada frente.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TILAMA_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export type Frente = {
  code: "LA_GUANACA" | "LOS_VERDES" | "CASTELLANA";
  name: string;
  shortName: string;
  priority: "alta" | "media" | "exploración";
  center: { lat: number; lng: number };
  bbox: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  highlightSamples: string[]; // códigos TOO destacados desde la imagen
  expectedGradeRange: [number, number]; // % Cu
  method: "open_pit" | "underground" | "pirquen_mecanizado";
  areaHa: number; // área del polígono superficial
  thicknessM: number; // potencia explotable media
  color: string; // hex para el render
};

export const FRENTES: Frente[] = [
  {
    code: "LA_GUANACA",
    name: "Frente 1 — La Guanaca",
    shortName: "La Guanaca",
    priority: "alta",
    center: { lat: -32.044, lng: -71.1156 },
    bbox: { latMin: -32.05, latMax: -32.038, lngMin: -71.122, lngMax: -71.108 },
    highlightSamples: ["TOO-126", "TOO-156", "TOO-155"],
    expectedGradeRange: [1.76, 4.34],
    method: "underground",
    areaHa: 4.2,
    thicknessM: 6.5,
    color: "#c0392b",
  },
  {
    code: "LOS_VERDES",
    name: "Frente 2 — Los Verdes (Acceso Actual)",
    shortName: "Los Verdes",
    priority: "media",
    center: { lat: -32.049, lng: -71.105 },
    bbox: { latMin: -32.055, latMax: -32.044, lngMin: -71.11, lngMax: -71.098 },
    highlightSamples: ["TOO-124", "TOO-105", "TOO-103"],
    expectedGradeRange: [0.38, 1.07],
    method: "open_pit",
    areaHa: 3.1,
    thicknessM: 12.0,
    color: "#d4ac0d",
  },
  {
    code: "CASTELLANA",
    name: "Frente 3 — Castellana (Zona Norte)",
    shortName: "Castellana",
    priority: "alta",
    center: { lat: -32.027, lng: -71.0986 },
    bbox: { latMin: -32.032, latMax: -32.022, lngMin: -71.105, lngMax: -71.092 },
    highlightSamples: ["TOO-210", "TOO-183", "TOO-184"],
    expectedGradeRange: [3.24, 6.83],
    method: "underground",
    areaHa: 2.6,
    thicknessM: 4.0,
    color: "#1e8449",
  },
];

export type FrenteRollup = {
  frente: Frente;
  veins: Array<{
    code: string;
    name: string;
    commodity: string;
    strike_deg: number;
    dip_deg: number;
    thickness_m: number;
    length_m: number;
    depth_top_m: number;
    depth_bottom_m: number;
  }>;
  anomaliesTop: Array<{
    code: string;
    cuPct: number | null;
    lat: number;
    lng: number;
    score: number | null;
    priority: string | null;
  }>;
  satTop: Array<{
    index_code: string;
    severity: string | null;
    score: number | null;
    area_ha: number | null;
  }>;
  phase: {
    phase_no: number;
    name: string;
    method: string;
    avg_thickness_m: number;
    density_tm3: number;
    cutoff_grade: number;
    recovery_pct: number;
    capex_usd: number;
    opex_usd_t: number;
    start_year: number;
    duration_years: number;
    grade_cu_pct: number | null;
  } | null;
  metrics: {
    sampleCount: number;
    avgCuPct: number;
    maxCuPct: number;
    tonnesInSitu: number;
    cuFinoTon: number;
    inSituValueUsd: number;
  };
};

export type LosVerdes5Report = {
  project: {
    id: string;
    code: string;
    name: string;
    region: string | null;
    commodity: string | null;
    center_lat: number;
    center_lng: number;
  };
  concessions: Array<{
    code: string;
    name: string;
    holder: string | null;
    area_ha: number | null;
    status: string | null;
    commune: string | null;
  }>;
  frentes: FrenteRollup[];
  totals: {
    totalArea_ha: number;
    totalTonnes: number;
    totalCuFinoTon: number;
    totalInSituUsd: number;
    concessionsTotal: number;
  };
};

function parseCuFromName(name: string): number | null {
  const m = name.match(/Cu\s+([\d.]+)\s*%/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function inBbox(lat: number, lng: number, b: Frente["bbox"]): boolean {
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

function bboxCenter(geom: GeoJSON.Geometry | null): [number, number] | null {
  if (!geom) return null;
  let lat = 0,
    lng = 0,
    n = 0;
  const walk = (coords: unknown): void => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        lng += coords[0] as number;
        lat += coords[1] as number;
        n += 1;
        return;
      }
      for (const c of coords) walk(c);
    }
  };
  // @ts-expect-error geometry coords
  walk(geom.coordinates);
  if (n === 0) return null;
  return [lat / n, lng / n];
}

export const getLosVerdes5Report = createServerFn({ method: "GET" }).handler(
  async (): Promise<LosVerdes5Report> => {
    const [proj, conc, veins, phases, targets, sat] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, code, name, region, commodity, center_lat, center_lng")
        .eq("id", TILAMA_PROJECT_ID)
        .single(),
      supabaseAdmin
        .from("mining_concessions")
        .select("code, name, holder, area_ha, status, commune")
        .eq("project_id", TILAMA_PROJECT_ID)
        .limit(30),
      supabaseAdmin
        .from("veins")
        .select(
          "code, name, commodity, strike_deg, dip_deg, thickness_m, length_m, depth_top_m, depth_bottom_m, geometry",
        )
        .eq("project_id", TILAMA_PROJECT_ID),
      supabaseAdmin
        .from("mine_plan_phases")
        .select(
          "phase_no, name, method, avg_thickness_m, density_tm3, cutoff_grade, recovery_pct, capex_usd, opex_usd_t, start_year, duration_years, grade_estimate, area_polygon",
        )
        .eq("project_id", TILAMA_PROJECT_ID)
        .order("phase_no"),
      supabaseAdmin
        .from("exploration_targets")
        .select("code, name, lat, lng, score, priority")
        .eq("project_id", TILAMA_PROJECT_ID),
      supabaseAdmin
        .from("satellite_anomalies")
        .select("index_code, severity, score, area_ha, geometry")
        .eq("project_id", TILAMA_PROJECT_ID)
        .order("score", { ascending: false })
        .limit(120),
    ]);

    if (proj.error || !proj.data) throw new Error("Proyecto Tilama no encontrado");

    const veinRows = veins.data ?? [];
    const phaseRows = phases.data ?? [];
    const targetRows = targets.data ?? [];
    const satRows = sat.data ?? [];

    const frentes: FrenteRollup[] = FRENTES.map((f, idx) => {
      // Targets dentro del bbox
      const tgtIn = targetRows.filter(
        (t) => t.lat != null && t.lng != null && inBbox(Number(t.lat), Number(t.lng), f.bbox),
      );
      const anomaliesTop = tgtIn
        .map((t) => ({
          code: String(t.code ?? ""),
          cuPct: parseCuFromName(String(t.name ?? "")),
          lat: Number(t.lat),
          lng: Number(t.lng),
          score: t.score != null ? Number(t.score) : null,
          priority: t.priority ?? null,
        }))
        .sort((a, b) => (b.cuPct ?? 0) - (a.cuPct ?? 0))
        .slice(0, 12);

      // Vetas asociadas por prefijo de código
      const veinPrefix =
        f.code === "LA_GUANACA" ? "V-LG" : f.code === "CASTELLANA" ? "V-CS" : "V-TM";
      const veinList = veinRows
        .filter((v) => String(v.code ?? "").startsWith(veinPrefix))
        .map((v) => ({
          code: String(v.code),
          name: String(v.name),
          commodity: String(v.commodity ?? "Cu"),
          strike_deg: Number(v.strike_deg ?? 0),
          dip_deg: Number(v.dip_deg ?? 70),
          thickness_m: Number(v.thickness_m ?? 0),
          length_m: Number(v.length_m ?? 0),
          depth_top_m: Number(v.depth_top_m ?? 0),
          depth_bottom_m: Number(v.depth_bottom_m ?? 150),
        }));

      // Anomalías satelitales por bbox
      const satIn = satRows
        .filter((s) => {
          const c = bboxCenter(s.geometry as GeoJSON.Geometry | null);
          return c ? inBbox(c[0], c[1], f.bbox) : false;
        })
        .slice(0, 8)
        .map((s) => ({
          index_code: String(s.index_code ?? ""),
          severity: s.severity ?? null,
          score: s.score != null ? Number(s.score) : null,
          area_ha: s.area_ha != null ? Number(s.area_ha) : null,
        }));

      const phase = phaseRows[idx]
        ? {
            phase_no: Number(phaseRows[idx].phase_no),
            name: String(phaseRows[idx].name),
            method: String(phaseRows[idx].method),
            avg_thickness_m: Number(phaseRows[idx].avg_thickness_m),
            density_tm3: Number(phaseRows[idx].density_tm3),
            cutoff_grade: Number(phaseRows[idx].cutoff_grade),
            recovery_pct: Number(phaseRows[idx].recovery_pct),
            capex_usd: Number(phaseRows[idx].capex_usd),
            opex_usd_t: Number(phaseRows[idx].opex_usd_t),
            start_year: Number(phaseRows[idx].start_year),
            duration_years: Number(phaseRows[idx].duration_years),
            grade_cu_pct:
              phaseRows[idx].grade_estimate &&
              typeof (phaseRows[idx].grade_estimate as Record<string, unknown>).cu === "number"
                ? Number((phaseRows[idx].grade_estimate as Record<string, unknown>).cu)
                : null,
          }
        : null;

      // KPIs
      const cuValues = anomaliesTop.map((a) => a.cuPct).filter((v): v is number => v != null);
      const avgCu = cuValues.length ? cuValues.reduce((a, b) => a + b, 0) / cuValues.length : 0;
      const maxCu = cuValues.length ? Math.max(...cuValues) : 0;

      // Cubicación: área × potencia × densidad × ley media
      const tonnes = f.areaHa * 10000 * f.thicknessM * 2.7;
      const refGrade = avgCu > 0 ? avgCu : (f.expectedGradeRange[0] + f.expectedGradeRange[1]) / 2;
      const cuFino = tonnes * (refGrade / 100);
      const inSituUsd = cuFino * 9200;

      return {
        frente: f,
        veins: veinList,
        anomaliesTop,
        satTop: satIn,
        phase,
        metrics: {
          sampleCount: tgtIn.length,
          avgCuPct: avgCu,
          maxCuPct: maxCu,
          tonnesInSitu: tonnes,
          cuFinoTon: cuFino,
          inSituValueUsd: inSituUsd,
        },
      };
    });

    const totals = {
      totalArea_ha: FRENTES.reduce((s, f) => s + f.areaHa, 0),
      totalTonnes: frentes.reduce((s, r) => s + r.metrics.tonnesInSitu, 0),
      totalCuFinoTon: frentes.reduce((s, r) => s + r.metrics.cuFinoTon, 0),
      totalInSituUsd: frentes.reduce((s, r) => s + r.metrics.inSituValueUsd, 0),
      concessionsTotal: conc.data?.length ?? 0,
    };

    return {
      project: proj.data as LosVerdes5Report["project"],
      concessions: (conc.data ?? []).map((c) => ({
        code: String(c.code),
        name: String(c.name),
        holder: c.holder ?? null,
        area_ha: c.area_ha != null ? Number(c.area_ha) : null,
        status: c.status ?? null,
        commune: c.commune ?? null,
      })),
      frentes,
      totals,
    };
  },
);
