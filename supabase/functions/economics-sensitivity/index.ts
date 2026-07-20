// Sensitivity tornado for an economic scenario.
// Pulls base scenario + model + blocks ONCE, then recomputes NPV with parameter
// overrides (±deltaPct on each axis). Does NOT write to the database.
// Returns: { base: {npv,irr,...}, variations: [{param, low, high, low_npv, high_npv}] }

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser, requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Block {
  id: string;
  ix: number;
  iy: number;
  iz: number;
  x: number;
  y: number;
  z: number;
  grade: number | null;
}
interface Scenario {
  id: string;
  project_id: string;
  model_id: string;
  commodity_price_usd: number;
  price_unit: string;
  recovery_pct: number;
  payable_pct: number;
  mining_cost_usd_t: number;
  processing_cost_usd_t: number;
  ga_cost_usd_t: number;
  waste_cost_usd_t: number;
  royalty_pct: number;
  refining_cost_usd_oz: number;
  transport_cost_usd_t: number;
  slope_angle_deg: number;
  annual_throughput_t: number;
  discount_rate_pct: number;
  ramp_up_years: number;
  capex_usd: number;
  sustaining_capex_usd_t: number;
}
interface Model {
  id: string;
  commodity: string;
  density_t_m3: number;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
}

function nsrPerTonne(grade: number, s: Scenario, m: Model): number {
  const rec = s.recovery_pct / 100;
  const pay = s.payable_pct / 100;
  let rev = 0;
  if (s.price_unit === "usd_per_oz") {
    const oz = grade / 31.1035;
    rev = oz * rec * pay * s.commodity_price_usd - oz * rec * pay * s.refining_cost_usd_oz;
  } else if (s.price_unit === "usd_per_lb") {
    const lb = grade * 22.0462;
    rev = lb * rec * pay * s.commodity_price_usd;
  } else {
    const t =
      m.commodity === "cu" || m.commodity === "fe" || m.commodity === "zn" || m.commodity === "pb"
        ? grade / 100
        : grade / 1_000_000;
    rev = t * rec * pay * s.commodity_price_usd;
  }
  rev *= 1 - s.royalty_pct / 100;
  return rev;
}

function buildPit(
  blocks: Block[],
  ore: Map<string, boolean>,
  m: Model,
  slopeDeg: number,
): Set<string> {
  const idx = new Map<string, Block>();
  let maxZ = -Infinity;
  for (const b of blocks) {
    idx.set(`${b.ix}_${b.iy}_${b.iz}`, b);
    if (b.iz > maxZ) maxZ = b.iz;
  }
  const slopeTan = Math.tan((slopeDeg * Math.PI) / 180);
  const lat = m.block_size_z / Math.max(slopeTan, 0.01) / Math.max(m.block_size_x, m.block_size_y);
  const inPit = new Set<string>();
  for (const b of blocks) {
    if (!ore.get(b.id)) continue;
    const depth = maxZ - b.iz;
    let posCount = 0,
      total = 0;
    for (let dz = 0; dz <= depth; dz++) {
      const r = Math.ceil(dz * lat);
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const k = `${b.ix + dx}_${b.iy + dy}_${b.iz + dz}`;
          const a = idx.get(k);
          if (!a) continue;
          total++;
          if (ore.get(a.id)) posCount++;
        }
      }
    }
    if (total > 0 && posCount / total >= 0.08) {
      for (let dz = 0; dz <= depth; dz++) {
        const r = Math.ceil(dz * lat);
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const k = `${b.ix + dx}_${b.iy + dy}_${b.iz + dz}`;
            if (idx.has(k)) inPit.add(idx.get(k)!.id);
          }
        }
      }
    }
  }
  return inPit;
}

function irrCompute(cf: number[]): number | null {
  const npv = (r: number) => cf.reduce((a, c, t) => a + c / Math.pow(1 + r, t), 0);
  if (npv(0) <= 0) return null;
  let lo = 0,
    hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1) return mid * 100;
    if (v > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

function runCase(blocks: Block[], s: Scenario, m: Model) {
  const blockVol = m.block_size_x * m.block_size_y * m.block_size_z;
  const blockT = blockVol * Number(m.density_t_m3);
  const totalProc =
    s.mining_cost_usd_t + s.processing_cost_usd_t + s.ga_cost_usd_t + s.transport_cost_usd_t;
  const ore = new Map<string, boolean>();
  const nsrMap = new Map<string, number>();
  for (const b of blocks) {
    if (b.grade == null || b.grade <= 0) {
      ore.set(b.id, false);
      continue;
    }
    const nsr = nsrPerTonne(b.grade, s, m);
    ore.set(b.id, nsr - totalProc > 0);
    nsrMap.set(b.id, nsr);
  }
  const inPit = buildPit(blocks, ore, m, s.slope_angle_deg);
  const oreBlocks = blocks
    .filter((b) => ore.get(b.id) && inPit.has(b.id))
    .sort((a, b) => (nsrMap.get(b.id) ?? 0) - (nsrMap.get(a.id) ?? 0));
  const wasteN = blocks.filter((b) => !ore.get(b.id) && inPit.has(b.id)).length;
  const totalOreT = oreBlocks.length * blockT;
  const totalWasteT = wasteN * blockT;
  const years = Math.max(1, Math.ceil(totalOreT / s.annual_throughput_t));
  const wastePerYr = totalWasteT / years;
  let cursor = 0;
  const yearly: { revenue: number; opex: number }[] = [];
  for (let y = 1; y <= years; y++) {
    let oreT = 0,
      rev = 0;
    const target = s.annual_throughput_t * Math.min(1, y / Math.max(1, s.ramp_up_years));
    while (oreT < target && cursor < oreBlocks.length) {
      const b = oreBlocks[cursor++];
      const t = blockT;
      oreT += t;
      rev += (nsrMap.get(b.id) ?? 0) * t;
    }
    const opex =
      oreT *
        (s.mining_cost_usd_t +
          s.processing_cost_usd_t +
          s.ga_cost_usd_t +
          s.transport_cost_usd_t +
          s.sustaining_capex_usd_t) +
      wastePerYr * (s.mining_cost_usd_t + s.waste_cost_usd_t);
    yearly.push({ revenue: rev, opex });
  }
  const cf = [-s.capex_usd, ...yearly.map((y) => y.revenue - y.opex)];
  const npv = cf.reduce((a, c, t) => a + c / Math.pow(1 + s.discount_rate_pct / 100, t), 0);
  const irr = irrCompute(cf);
  return { npv_usd: npv, irr_pct: irr, mine_life_years: years, ore_tonnes: totalOreT };
}

const PARAM_LABELS: Record<string, string> = {
  commodity_price_usd: "Precio commodity",
  recovery_pct: "Recovery",
  mining_cost_usd_t: "Costo minado",
  processing_cost_usd_t: "Costo proceso",
  ga_cost_usd_t: "G&A",
  royalty_pct: "Royalty",
  discount_rate_pct: "Tasa descuento",
  capex_usd: "Capex",
  annual_throughput_t: "Throughput",
  slope_angle_deg: "Ángulo talud",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const body = await req.json();
    const scenario_id: string = body.scenario_id;
    const delta_pct: number = Number(body.delta_pct ?? 20);
    const params: string[] = body.params ?? Object.keys(PARAM_LABELS);
    if (!scenario_id) throw new Error("scenario_id required");

    const { data: scenario, error: sErr } = await supabase
      .from("economic_scenarios")
      .select("*")
      .eq("id", scenario_id)
      .single();
    if (sErr || !scenario) throw new Error("Scenario not found");
    const { data: model, error: mErr } = await supabase
      .from("resource_models")
      .select("*")
      .eq("id", scenario.model_id)
      .single();
    if (mErr || !model) throw new Error("Model not found");
    const { data: blocks, error: bErr } = await supabase
      .from("resource_blocks")
      .select("id, ix, iy, iz, x, y, z, grade")
      .eq("model_id", scenario.model_id);
    if (bErr) throw bErr;
    if (!blocks || blocks.length === 0) throw new Error("No blocks");

    const m = model as Model;
    const s = scenario as Scenario;
    const blks = blocks as Block[];

    const base = runCase(blks, s, m);
    const variations: Array<{
      param: string;
      label: string;
      base_value: number;
      low_value: number;
      high_value: number;
      low_npv: number;
      high_npv: number;
      low_irr: number;
      high_irr: number;
      swing: number;
    }> = [];
    const d = delta_pct / 100;
    for (const p of params) {
      if (!(p in s)) continue;
      const baseVal = Number((s as Record<string, unknown>)[p]);
      if (!Number.isFinite(baseVal) || baseVal === 0) continue;
      const sLow: Scenario = { ...s, [p]: baseVal * (1 - d) } as Scenario;
      const sHigh: Scenario = { ...s, [p]: baseVal * (1 + d) } as Scenario;
      const lo = runCase(blks, sLow, m);
      const hi = runCase(blks, sHigh, m);
      variations.push({
        param: p,
        label: PARAM_LABELS[p] ?? p,
        base_value: baseVal,
        low_value: baseVal * (1 - d),
        high_value: baseVal * (1 + d),
        low_npv: lo.npv_usd,
        high_npv: hi.npv_usd,
        low_irr: lo.irr_pct,
        high_irr: hi.irr_pct,
        swing: Math.abs(hi.npv_usd - lo.npv_usd),
      });
    }
    variations.sort((a, b) => b.swing - a.swing);

    return new Response(JSON.stringify({ ok: true, base, variations, delta_pct }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
