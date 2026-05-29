// Algoritmo conceptual de modelado geocientífico nivel Datamine "lite".
// - Desurvey de sondajes sintéticos
// - Sembrado de leyes log-normales por anomalías/vetas
// - IDW block model
// - Floating cone pit shells
//
// Ejecuta solo en servidor (importa supabaseAdmin via .functions wrapper).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import proj4 from "proj4";

proj4.defs("EPSG:32719", "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs");

// PRNG determinístico para repetibilidad
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type LngLat = [number, number];

export type GenerateOpts = {
  projectId: string;
  holesPerVein?: number;       // default 3
  maxAnomalyHoles?: number;    // default 10
  depthMin?: number;           // 180
  depthMax?: number;           // 350
  blockSize?: number;          // 15 (m)
  blockSizeZ?: number;         // 10 (m)
  domainPadM?: number;         // 200 m padding alrededor de collares
};

export type GenerateReport = {
  projectId: string;
  drillholes: number;
  assays: number;
  blocks: number;
  pitShells: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  centerLngLat: { lng: number; lat: number };
};

const COMMODITY_PRICE_USD_PER_PCT_TONNE = {
  cu: 75,   // ~USD por % Cu por tonelada (estimación gruesa con precio 9000 USD/t y recovery 90%)
  au_gpt: 50, // USD por g/t Au por tonelada (~$60/g recovery 0.8)
  ag_gpt: 0.6,
};

const MINING_COST_USD_PER_TONNE = 2.8;
const PROCESS_COST_USD_PER_TONNE = 8.5;
const CUTOFF_CU_EQ = 0.25; // % Cu eq

function cuEquivalent(cu: number, au: number, ag: number, mo: number): number {
  // Equivalencia con factores conservadores
  return cu + au * 0.6 + ag * 0.008 + mo * 4;
}

// ─── Helpers UTM ────────────────────────────────────────────────────────────
function toUtm(lng: number, lat: number): [number, number] {
  return proj4("EPSG:4326", "EPSG:32719", [lng, lat]) as [number, number];
}

// ─── Main generator ─────────────────────────────────────────────────────────
export async function generateConceptualModel(opts: GenerateOpts): Promise<GenerateReport> {
  const {
    projectId,
    holesPerVein = 3,
    maxAnomalyHoles = 10,
    depthMin = 180,
    depthMax = 350,
    blockSize = 15,
    blockSizeZ = 10,
    domainPadM = 200,
  } = opts;

  // 1. Cargar fuentes reales: proyecto, anomalías, vetas, targets
  const [projRes, satRes, veinsRes] = await Promise.all([
    supabaseAdmin.from("projects").select("center_lng, center_lat").eq("id", projectId).maybeSingle(),
    supabaseAdmin.from("satellite_anomalies").select("id, bbox, score, severity, area_ha").eq("project_id", projectId),
    supabaseAdmin.from("veins").select("id, code, name, strike_deg, dip_deg, dip_dir_deg, thickness_m, depth_top_m, depth_bottom_m, grade_estimate, geometry").eq("project_id", projectId),
  ]);

  if (!projRes.data) throw new Error(`Project ${projectId} not found`);
  const centerLng = Number(projRes.data.center_lng);
  const centerLat = Number(projRes.data.center_lat);
  const [centerX, centerY] = toUtm(centerLng, centerLat);
  const seed = projectId.split("-").reduce((a, p) => a + parseInt(p.slice(0, 4) || "0", 16), 0);
  const rng = mulberry32(seed);

  // 2. Generar collares de sondajes
  type Hole = {
    code: string;
    x: number; y: number; z: number; // UTM
    az: number; dip: number; depth: number;
    fromKind: "vein" | "anomaly" | "target";
    fromId: string;
    mineralizedFromM: number;
    mineralizedToM: number;
    targetCu: number;   // ley máxima esperada (%)
    targetAu: number;   // g/t
    halfWidth: number;  // espesor (m) de la zona mineralizada
  };
  const holes: Hole[] = [];

  const veins = (veinsRes.data ?? []) as Array<{
    id: string; code: string; name: string;
    strike_deg: number | null; dip_deg: number | null; dip_dir_deg: number | null;
    thickness_m: number | null; depth_top_m: number | null; depth_bottom_m: number | null;
    grade_estimate: Record<string, number> | null;
    geometry: { type: string; coordinates: LngLat[] } | null;
  }>;

  let holeIdx = 1;

  // 2a. Vetas → sondajes perpendiculares a strike, a lo largo de la traza
  for (const v of veins) {
    if (!v.geometry?.coordinates?.length) continue;
    const coords = v.geometry.coordinates;
    const strike = v.strike_deg ?? 0;
    const dip = -(v.dip_deg ?? 60); // dip positivo en BD → trayectoria hacia abajo
    const dipDir = v.dip_dir_deg ?? (strike + 90); // dirección de buzamiento
    const thickness = v.thickness_m ?? 2;
    const depthTop = v.depth_top_m ?? 30;
    const depthBot = v.depth_bottom_m ?? 200;
    const gradeCu = (v.grade_estimate?.cu ?? v.grade_estimate?.cu_pct ?? 0.6) as number;
    const gradeAu = (v.grade_estimate?.au ?? v.grade_estimate?.au_gpt ?? 0.4) as number;

    // distribuir N collares uniformes a lo largo del strike, offset 30-60 m hacia la dirección opuesta al dipDir
    for (let i = 0; i < holesPerVein; i++) {
      const t = (i + 0.5) / holesPerVein;
      const seg = Math.floor(t * (coords.length - 1));
      const segT = t * (coords.length - 1) - seg;
      const [aLng, aLat] = coords[seg];
      const [bLng, bLat] = coords[Math.min(coords.length - 1, seg + 1)];
      const lng = aLng + (bLng - aLng) * segT;
      const lat = aLat + (bLat - aLat) * segT;
      const [hx, hy] = toUtm(lng, lat);

      // offset al lado opuesto al dipDir (collar hacia hanging-wall)
      const offsetM = 30 + rng() * 30;
      const opp = ((dipDir + 180) * Math.PI) / 180;
      const ox = Math.sin(opp) * offsetM;
      const oy = Math.cos(opp) * offsetM;

      const collarZ = 1200 + (rng() - 0.5) * 80; // elev aprox Tilama (~1200 m snm)
      const depth = depthMin + rng() * (depthMax - depthMin);
      // intersección estimada con la veta
      const interFrom = depthTop / Math.sin(Math.abs(dip) * Math.PI / 180);
      const interTo = Math.min(depth, depthBot / Math.sin(Math.abs(dip) * Math.PI / 180));

      holes.push({
        code: `LV-VEIN-${String(holeIdx).padStart(3, "0")}`,
        x: hx + ox, y: hy + oy, z: collarZ,
        az: dipDir, dip,
        depth,
        fromKind: "vein", fromId: v.id,
        mineralizedFromM: Math.max(10, interFrom - thickness),
        mineralizedToM: Math.min(depth - 5, interTo + thickness),
        targetCu: gradeCu, targetAu: gradeAu,
        halfWidth: thickness * 1.2,
      });
      holeIdx++;
    }
  }

  // 2b. Anomalías SAT high-score → sondajes verticales/inclinados
  const sats = (satRes.data ?? [])
    .map((s) => {
      const bb = (s.bbox as number[] | null) ?? [];
      const lng = bb.length >= 4 ? (Number(bb[0]) + Number(bb[2])) / 2 : NaN;
      const lat = bb.length >= 4 ? (Number(bb[1]) + Number(bb[3])) / 2 : NaN;
      return {
        id: s.id as string,
        lng, lat,
        score: Number(s.score ?? 0.5),
        severity: s.severity as string | null,
        area_ha: Number(s.area_ha ?? 1),
      };
    })
    .filter((s) => Number.isFinite(s.lng) && Number.isFinite(s.lat))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxAnomalyHoles);

  for (const s of sats) {
    const [hx, hy] = toUtm(s.lng, s.lat);
    const collarZ = 1200 + (rng() - 0.5) * 60;
    const dipAng = -(60 + rng() * 25);
    const az = rng() * 360;
    const depth = depthMin + rng() * (depthMax - depthMin);
    // ley objetivo modulada por score
    const targetCu = 0.25 + s.score * 0.9 + gauss(rng) * 0.1;
    const targetAu = 0.1 + s.score * 0.5 + gauss(rng) * 0.05;
    const mineralizedStart = 30 + rng() * 60;
    const mineralizedEnd = mineralizedStart + 40 + rng() * 80;
    holes.push({
      code: `LV-SAT-${String(holeIdx).padStart(3, "0")}`,
      x: hx, y: hy, z: collarZ,
      az, dip: dipAng,
      depth,
      fromKind: "anomaly", fromId: s.id,
      mineralizedFromM: mineralizedStart,
      mineralizedToM: Math.min(depth - 5, mineralizedEnd),
      targetCu: Math.max(0.15, targetCu),
      targetAu: Math.max(0.05, targetAu),
      halfWidth: 8 + rng() * 6,
    });
    holeIdx++;
  }

  if (holes.length === 0) throw new Error("No source data (veins/anomalies) to seed conceptual model");

  // 3. Desurvey + assays
  type AssayRow = {
    hole_id: string; from_m: number; to_m: number;
    cu_pct: number; au_gpt: number; ag_gpt: number; mo_pct: number;
    lithology: string; alteration: string; mineralized: boolean;
  };
  type DesurveyPoint = { x: number; y: number; z: number; cuEq: number; conf: number };
  const allDesurveyPoints: DesurveyPoint[] = [];
  const holeInserts: Array<{
    id?: string;
    project_id: string;
    hole_code: string;
    collar_x_utm: number; collar_y_utm: number; collar_z_m: number;
    utm_zone: number; azimuth_deg: number; dip_deg: number; depth_m: number;
    source: string; generated_from_kind: string; generated_from_id: string;
    is_conceptual: boolean;
    meta: Record<string, unknown>;
  }> = [];

  // borrar generación previa
  await supabaseAdmin.from("synthetic_drillholes").delete().eq("project_id", projectId);
  await supabaseAdmin.from("synthetic_block_model").delete().eq("project_id", projectId);
  await supabaseAdmin.from("pit_shells").delete().eq("project_id", projectId);

  for (const h of holes) {
    holeInserts.push({
      project_id: projectId,
      hole_code: h.code,
      collar_x_utm: h.x, collar_y_utm: h.y, collar_z_m: h.z,
      utm_zone: 19, azimuth_deg: h.az, dip_deg: h.dip, depth_m: h.depth,
      source: "ai_target_v1",
      generated_from_kind: h.fromKind,
      generated_from_id: h.fromId,
      is_conceptual: true,
      meta: { halfWidth: h.halfWidth, targetCu: h.targetCu, targetAu: h.targetAu },
    });
  }

  const insertedHoles = await supabaseAdmin
    .from("synthetic_drillholes")
    .insert(holeInserts)
    .select("id, hole_code");
  if (insertedHoles.error) throw new Error(`insert holes: ${insertedHoles.error.message}`);
  const holeIdByCode = new Map<string, string>();
  for (const r of insertedHoles.data!) holeIdByCode.set(r.hole_code as string, r.id as string);

  const assayRows: AssayRow[] = [];
  const INTERVAL_M = 2;

  for (const h of holes) {
    const dbId = holeIdByCode.get(h.code)!;
    const azRad = (h.az * Math.PI) / 180;
    const dipRad = (h.dip * Math.PI) / 180;
    const dx = Math.sin(azRad) * Math.cos(dipRad);
    const dy = Math.cos(azRad) * Math.cos(dipRad);
    const dz = Math.sin(dipRad); // negativo (dip < 0)

    const nSamples = Math.ceil(h.depth / INTERVAL_M);
    for (let i = 0; i < nSamples; i++) {
      const fromM = i * INTERVAL_M;
      const toM = Math.min(h.depth, fromM + INTERVAL_M);
      const midM = (fromM + toM) / 2;
      const x = h.x + dx * midM;
      const y = h.y + dy * midM;
      const z = h.z + dz * midM;

      // Decide mineralización por proximidad al intervalo mineralizado +/- halfWidth
      const dCenter = Math.abs(midM - (h.mineralizedFromM + h.mineralizedToM) / 2);
      const halfSpan = (h.mineralizedToM - h.mineralizedFromM) / 2;
      const t = halfSpan > 0 ? Math.max(0, 1 - dCenter / (halfSpan + h.halfWidth)) : 0;
      const isMin = t > 0.05;

      // ley log-normal con caída suave
      const noise = Math.exp(gauss(rng) * 0.35);
      const cu = isMin ? Math.max(0.02, h.targetCu * t * noise) : 0.005 + Math.abs(gauss(rng)) * 0.02;
      const au = isMin ? Math.max(0.01, h.targetAu * t * noise * (0.7 + rng() * 0.6)) : 0.005 + Math.abs(gauss(rng)) * 0.02;
      const ag = isMin ? cu * (4 + rng() * 8) : Math.abs(gauss(rng)) * 0.5;
      const mo = isMin ? cu * 0.02 * (0.5 + rng()) : 0;

      const lithology = isMin ? (h.fromKind === "vein" ? "Andesita silicificada" : "Pórfido cuarzo-diorítico") : "Andesita propilítica";
      const alteration = isMin ? (rng() > 0.4 ? "Sericita-cuarzo" : "K-silicato") : "Propilítica";

      assayRows.push({
        hole_id: dbId,
        from_m: fromM, to_m: toM,
        cu_pct: +cu.toFixed(3), au_gpt: +au.toFixed(3),
        ag_gpt: +ag.toFixed(2), mo_pct: +mo.toFixed(3),
        lithology, alteration, mineralized: isMin,
      });

      if (isMin) {
        const cuEq = cuEquivalent(cu, au, ag, mo);
        allDesurveyPoints.push({ x, y, z, cuEq, conf: t });
      }
    }
  }

  // Insertar assays en lotes
  const BATCH = 500;
  for (let i = 0; i < assayRows.length; i += BATCH) {
    const slice = assayRows.slice(i, i + BATCH);
    const r = await supabaseAdmin.from("synthetic_assays").insert(slice);
    if (r.error) throw new Error(`insert assays batch ${i}: ${r.error.message}`);
  }

  // 4. IDW block model
  if (allDesurveyPoints.length === 0) {
    return {
      projectId, drillholes: holes.length, assays: assayRows.length,
      blocks: 0, pitShells: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
      centerLngLat: { lng: centerLng, lat: centerLat },
    };
  }

  const xs = allDesurveyPoints.map((p) => p.x);
  const ys = allDesurveyPoints.map((p) => p.y);
  const zs = allDesurveyPoints.map((p) => p.z);
  const minX = Math.min(...xs) - domainPadM;
  const maxX = Math.max(...xs) + domainPadM;
  const minY = Math.min(...ys) - domainPadM;
  const maxY = Math.max(...ys) + domainPadM;
  const minZ = Math.min(...zs) - 50;
  const maxZ = Math.max(...zs) + 30;

  const nx = Math.min(60, Math.ceil((maxX - minX) / blockSize));
  const ny = Math.min(60, Math.ceil((maxY - minY) / blockSize));
  const nz = Math.min(30, Math.ceil((maxZ - minZ) / blockSizeZ));
  const sx = (maxX - minX) / nx;
  const sy = (maxY - minY) / ny;
  const sz = (maxZ - minZ) / nz;

  // IDW power 2, k=8, max radius 80m
  const SEARCH = 80;
  const blockRows: Array<{
    project_id: string;
    x_utm: number; y_utm: number; z_m: number;
    size_x: number; size_y: number; size_z: number;
    cu_eq_pct: number; confidence: number; domain: string; method: string; version: number;
  }> = [];

  // Index espacial simple por celda 80m
  const cellSize = SEARCH;
  const grid = new Map<string, DesurveyPoint[]>();
  const cellKey = (gx: number, gy: number, gz: number) => `${gx},${gy},${gz}`;
  for (const p of allDesurveyPoints) {
    const gx = Math.floor(p.x / cellSize);
    const gy = Math.floor(p.y / cellSize);
    const gz = Math.floor(p.z / cellSize);
    const k = cellKey(gx, gy, gz);
    const arr = grid.get(k) ?? [];
    arr.push(p); grid.set(k, arr);
  }

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        const cx = minX + (i + 0.5) * sx;
        const cy = minY + (j + 0.5) * sy;
        const cz = minZ + (k + 0.5) * sz;
        // recolectar puntos vecinos
        const gx0 = Math.floor(cx / cellSize), gy0 = Math.floor(cy / cellSize), gz0 = Math.floor(cz / cellSize);
        const nbrs: DesurveyPoint[] = [];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
              const arr = grid.get(cellKey(gx0 + dx, gy0 + dy, gz0 + dz));
              if (arr) nbrs.push(...arr);
            }
        if (nbrs.length === 0) continue;
        // ordenar por distancia y tomar 8
        nbrs.sort((a, b) => ((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2));
        const top = nbrs.slice(0, 8).filter((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2 < SEARCH * SEARCH);
        if (top.length === 0) continue;
        let num = 0, den = 0, confSum = 0;
        for (const p of top) {
          const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2;
          const w = 1 / (d2 + 1);
          num += w * p.cuEq;
          den += w;
          confSum += p.conf * w;
        }
        const cuEq = num / den;
        if (cuEq < 0.05) continue;
        const conf = Math.min(1, (confSum / den) * Math.min(1, top.length / 4));
        blockRows.push({
          project_id: projectId,
          x_utm: cx, y_utm: cy, z_m: cz,
          size_x: sx, size_y: sy, size_z: sz,
          cu_eq_pct: +cuEq.toFixed(4),
          confidence: +conf.toFixed(3),
          domain: cuEq > 0.6 ? "high-grade" : cuEq > 0.3 ? "mineralized" : "halo",
          method: "idw_p2_k8",
          version: 1,
        });
      }
    }
  }

  // Insertar block model en lotes
  for (let i = 0; i < blockRows.length; i += BATCH) {
    const slice = blockRows.slice(i, i + BATCH);
    const r = await supabaseAdmin.from("synthetic_block_model").insert(slice);
    if (r.error) throw new Error(`insert blocks batch ${i}: ${r.error.message}`);
  }

  // 5. Pit shells (floating cone simplificado por revenue factor)
  // Para cada bloque "ore" (cuEq > cutoff * RF), expandir cono 45° hacia arriba.
  // Aproximación: shell = mínimo Z(i,j) sobre todos los conos.
  type Shell = { rf: number; pitTop: number[][]; tonnage: number; gradeAvg: number; strip: number; npv: number };
  const shells: Shell[] = [];
  const DENSITY = 2.7; // t/m3
  const blockVol = sx * sy * sz; // m3
  const blockTon = blockVol * DENSITY;

  // 2D grid (x,y) con altura mínima del cono
  for (const rf of [0.4, 0.6, 0.8, 1.0]) {
    const cutoff = CUTOFF_CU_EQ / rf;
    const pitTop: number[][] = Array.from({ length: nx }, () => Array(ny).fill(maxZ));
    let oreTon = 0, gradeSum = 0, wasteTon = 0;
    // sort blocks descending cuEq
    for (const b of blockRows) {
      if (b.cu_eq_pct < cutoff) continue;
      const i = Math.floor((b.x_utm - minX) / sx);
      const j = Math.floor((b.y_utm - minY) / sy);
      const k = (b.z_m - minZ) / sz;
      const topZ = b.z_m + sz / 2;
      // expandir cono 45°: para cada (i', j') con distancia <= (maxZ - topZ)/sz
      const maxRange = Math.ceil((maxZ - topZ) / Math.min(sx, sy));
      for (let di = -maxRange; di <= maxRange; di++) {
        for (let dj = -maxRange; dj <= maxRange; dj++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || ii >= nx || jj < 0 || jj >= ny) continue;
          const horiz = Math.sqrt((di * sx) ** 2 + (dj * sy) ** 2);
          const reqZ = topZ + horiz; // 45°
          if (reqZ < pitTop[ii][jj]) pitTop[ii][jj] = reqZ;
        }
      }
      oreTon += blockTon * (b.cu_eq_pct / 100 > 0 ? 1 : 0);
      gradeSum += b.cu_eq_pct * blockTon;
      void k;
    }
    // calcular strip aprox: bloques fuera de ore pero bajo pitTop
    for (const b of blockRows) {
      const i = Math.floor((b.x_utm - minX) / sx);
      const j = Math.floor((b.y_utm - minY) / sy);
      const top = pitTop[i]?.[j] ?? maxZ;
      if (b.z_m < top && b.cu_eq_pct < cutoff) wasteTon += blockTon;
    }
    const tonMt = oreTon / 1e6;
    const gradeAvg = oreTon > 0 ? gradeSum / oreTon : 0;
    const strip = oreTon > 0 ? wasteTon / oreTon : 0;
    // NPV gruesa: revenue - mining - process
    const revenuePerT = gradeAvg * COMMODITY_PRICE_USD_PER_PCT_TONNE.cu;
    const opex = MINING_COST_USD_PER_TONNE * (1 + strip) + PROCESS_COST_USD_PER_TONNE;
    const npv = oreTon * (revenuePerT - opex) * 0.62; // discount lump
    // build mesh (triangle strip of pit surface)
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x = minX + (i + 0.5) * sx;
        const y = minY + (j + 0.5) * sy;
        const z = pitTop[i][j];
        positions.push(x, y, z);
      }
    }
    for (let i = 0; i < nx - 1; i++) {
      for (let j = 0; j < ny - 1; j++) {
        const a = i * ny + j;
        const b = (i + 1) * ny + j;
        const c = (i + 1) * ny + j + 1;
        const d = i * ny + j + 1;
        // solo si la celda tiene pit (no es maxZ)
        const za = positions[a * 3 + 2];
        const zb = positions[b * 3 + 2];
        const zc = positions[c * 3 + 2];
        const zd = positions[d * 3 + 2];
        if (za >= maxZ - 0.001 && zb >= maxZ - 0.001 && zc >= maxZ - 0.001 && zd >= maxZ - 0.001) continue;
        indices.push(a, b, c, a, c, d);
      }
    }
    shells.push({
      rf, pitTop, tonnage: tonMt, gradeAvg, strip, npv,
    });
    const r = await supabaseAdmin.from("pit_shells").insert({
      project_id: projectId,
      revenue_factor: rf,
      tonnage_mt: +tonMt.toFixed(3),
      grade_avg_cu_eq: +gradeAvg.toFixed(4),
      strip_ratio: +strip.toFixed(2),
      npv_usd: +npv.toFixed(0),
      mesh_positions: positions,
      mesh_indices: indices,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
      method: "floating_cone_45deg",
      is_conceptual: true,
    });
    if (r.error) throw new Error(`insert pit shell rf=${rf}: ${r.error.message}`);
  }

  return {
    projectId,
    drillholes: holes.length,
    assays: assayRows.length,
    blocks: blockRows.length,
    pitShells: shells.length,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    centerLngLat: { lng: centerLng, lat: centerLat },
  };
}
