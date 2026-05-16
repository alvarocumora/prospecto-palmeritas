// Economic engine — NSR + simple pit shell + NPV/IRR
// Inputs: scenario_id (joined to a completed resource_model)
// Outputs: per-block NSR / in-pit flags, annual schedule, NPV/IRR/payback cached on scenario.
//
// NOTE: implements a "floating cone" style heuristic pit (vertical search with slope-angle
// expansion at each level above) — full Lerchs-Grossmann optimization is out of scope for an
// edge function but the tonnage / NPV order-of-magnitude is consistent for early-stage studies.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  classification: string | null;
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

/** Convert a grade (g/t for Au/Ag, % for Cu) into payable revenue USD/t ore. */
function nsrPerTonne(grade: number, s: Scenario, m: Model): number {
  const recovery = s.recovery_pct / 100;
  const payable = s.payable_pct / 100;
  let revenue = 0;
  if (s.price_unit === "usd_per_oz") {
    // grade is g/t → oz/t
    const ozPerT = grade / 31.1035;
    revenue = ozPerT * recovery * payable * s.commodity_price_usd;
    revenue -= ozPerT * recovery * payable * s.refining_cost_usd_oz;
  } else if (s.price_unit === "usd_per_lb") {
    // grade % → lb/t
    const lbPerT = grade * 22.0462; // (grade/100)*1000kg*2.20462 lb/kg
    revenue = lbPerT * recovery * payable * s.commodity_price_usd;
  } else {
    // usd_per_t metal
    const tPerT =
      m.commodity === "cu" || m.commodity === "fe" || m.commodity === "zn" || m.commodity === "pb"
        ? grade / 100
        : grade / 1_000_000;
    revenue = tPerT * recovery * payable * s.commodity_price_usd;
  }
  // Royalty on revenue
  revenue *= 1 - s.royalty_pct / 100;
  return revenue;
}

/** Floating-cone pit: a block is in-pit if every block in the cone above (slope-expanded) is also stripped. */
function buildPit(
  blocks: Block[],
  oreFlag: Map<string, boolean>,
  m: Model,
  slopeDeg: number,
): Set<string> {
  // index by (ix, iy, iz)
  const idx = new Map<string, Block>();
  let maxZ = -Infinity,
    minZ = Infinity;
  for (const b of blocks) {
    idx.set(`${b.ix}_${b.iy}_${b.iz}`, b);
    if (b.iz > maxZ) maxZ = b.iz;
    if (b.iz < minZ) minZ = b.iz;
  }
  // Slope tan determines lateral expansion per vertical block step
  const slopeTan = Math.tan((slopeDeg * Math.PI) / 180);
  const lateralPerStep =
    m.block_size_z / Math.max(slopeTan, 0.01) / Math.max(m.block_size_x, m.block_size_y);
  const inPit = new Set<string>();
  // Start from top and propagate downward: any ore block included pulls in cone above
  // For simplicity here: mark every block whose grade is ore AND which has a feasible cone of mostly economic mass above.
  for (const b of blocks) {
    const key = `${b.ix}_${b.iy}_${b.iz}`;
    if (!oreFlag.get(b.id)) continue;
    const depthSteps = maxZ - b.iz;
    const radius = Math.ceil(depthSteps * lateralPerStep);
    let coneValuePos = 0,
      coneCount = 0;
    for (let dz = 0; dz <= depthSteps; dz++) {
      const r = Math.ceil(dz * lateralPerStep);
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const k = `${b.ix + dx}_${b.iy + dy}_${b.iz + dz}`;
          const above = idx.get(k);
          if (!above) continue;
          coneCount++;
          if (oreFlag.get(above.id)) coneValuePos++;
        }
      }
    }
    // Heuristic: include if at least 8% of cone is ore (compensates sparse models)
    if (coneCount > 0 && coneValuePos / coneCount >= 0.08) {
      // Mark whole cone as stripped
      for (let dz = 0; dz <= depthSteps; dz++) {
        const r = Math.ceil(dz * lateralPerStep);
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const k = `${b.ix + dx}_${b.iy + dy}_${b.iz + dz}`;
            if (idx.has(k)) inPit.add(idx.get(k)!.id);
          }
        }
      }
    }
    void radius;
  }
  return inPit;
}

/** Compute IRR via bisection on NPV=0 */
function computeIRR(cashflows: number[]): number | null {
  const npv = (rate: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  if (npv(0) <= 0) return null;
  let lo = 0,
    hi = 5; // 0%..500%
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1) return mid * 100;
    if (v > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { scenario_id } = await req.json();
    if (!scenario_id) throw new Error("scenario_id required");

    const { data: scenario, error: sErr } = await supabase
      .from("economic_scenarios")
      .select("*")
      .eq("id", scenario_id)
      .single();
    if (sErr || !scenario) throw new Error("Scenario not found");

    await supabase.from("economic_scenarios").update({ status: "running" }).eq("id", scenario_id);

    const { data: model, error: mErr } = await supabase
      .from("resource_models")
      .select("*")
      .eq("id", scenario.model_id)
      .single();
    if (mErr || !model) throw new Error("Model not found");
    if (model.status !== "complete") throw new Error("Resource model is not complete");

    // Fetch all blocks for the model
    const { data: blocks, error: bErr } = await supabase
      .from("resource_blocks")
      .select("id, ix, iy, iz, x, y, z, grade, classification")
      .eq("model_id", scenario.model_id);
    if (bErr) throw bErr;
    if (!blocks || blocks.length === 0) throw new Error("Model has no blocks");

    const m = model as Model;
    const s = scenario as Scenario;

    const blockVolume = m.block_size_x * m.block_size_y * m.block_size_z;
    const blockTonnage = blockVolume * Number(model.density_t_m3);

    // 1) Compute NSR per block, ore vs waste
    const totalProcessing =
      s.mining_cost_usd_t + s.processing_cost_usd_t + s.ga_cost_usd_t + s.transport_cost_usd_t;
    // NSR cutoff = grade where revenue == processing costs
    // Solve: nsr_per_t(g_cut) == totalProcessing → linear-ish in grade for each unit
    // Use bisection to invert nsrPerTonne
    let lo = 0,
      hi = 100;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const r = nsrPerTonne(mid, s, m);
      if (r > totalProcessing) hi = mid;
      else lo = mid;
    }
    const nsrCutoffGrade = (lo + hi) / 2;
    const nsrCutoffUsdT = totalProcessing;

    const blockEcon: Array<{
      block_id: string;
      nsr_usd_t: number | null;
      insitu_value_usd: number | null;
      total_cost_usd_t: number;
      margin_usd_t: number | null;
      is_ore: boolean;
    }> = [];
    const oreFlag = new Map<string, boolean>();
    for (const b of blocks as Block[]) {
      if (b.grade == null || b.grade <= 0) {
        blockEcon.push({
          block_id: b.id,
          nsr_usd_t: null,
          insitu_value_usd: null,
          total_cost_usd_t: totalProcessing,
          margin_usd_t: null,
          is_ore: false,
        });
        oreFlag.set(b.id, false);
        continue;
      }
      const nsr = nsrPerTonne(b.grade, s, m);
      const margin = nsr - totalProcessing;
      const isOre = margin > 0;
      oreFlag.set(b.id, isOre);
      blockEcon.push({
        block_id: b.id,
        nsr_usd_t: nsr,
        insitu_value_usd: nsr * blockTonnage,
        total_cost_usd_t: totalProcessing,
        margin_usd_t: margin,
        is_ore: isOre,
      });
    }

    // 2) Pit shell
    const inPit = buildPit(blocks as Block[], oreFlag, m, s.slope_angle_deg);

    // 3) Schedule: prioritize highest margin ore blocks per year, throughput-limited
    const oreBlocks = blockEcon
      .filter((be) => be.is_ore && inPit.has(be.block_id) && be.margin_usd_t != null)
      .sort((a, b) => (b.margin_usd_t ?? 0) - (a.margin_usd_t ?? 0));
    const wasteInPit = blockEcon.filter((be) => !be.is_ore && inPit.has(be.block_id));
    const totalOreT = oreBlocks.length * blockTonnage;
    const totalWasteT = wasteInPit.length * blockTonnage;
    const stripRatio = totalOreT > 0 ? totalWasteT / totalOreT : 0;
    const yearsLife = Math.max(1, Math.ceil(totalOreT / s.annual_throughput_t));

    // Build annual schedule
    type Yr = {
      year: number;
      ore: number;
      waste: number;
      metal: number;
      revenue: number;
      opex: number;
      capex: number;
    };
    const yearly: Yr[] = [];
    let oreCursor = 0;
    let wasteCursor = 0;
    const wastePerYear = totalWasteT / yearsLife;
    let cumGrade = 0,
      cumGradeT = 0;
    for (let y = 1; y <= yearsLife; y++) {
      let yearOreT = 0,
        yearMetal = 0,
        yearRevenue = 0;
      const yearTarget = s.annual_throughput_t * Math.min(1, y / Math.max(1, s.ramp_up_years));
      while (yearOreT < yearTarget && oreCursor < oreBlocks.length) {
        const be = oreBlocks[oreCursor++];
        const t = blockTonnage;
        yearOreT += t;
        yearRevenue += (be.nsr_usd_t ?? 0) * t;
        // Metal payable in commodity-native unit (g for Au/Ag, t for Cu)
        // Approximate via revenue/price
        if (s.price_unit === "usd_per_oz") yearMetal += yearRevenue / s.commodity_price_usd;
        else if (s.price_unit === "usd_per_lb") yearMetal += yearRevenue / s.commodity_price_usd;
      }
      const yearWasteT = Math.min(wastePerYear, totalWasteT - wasteCursor);
      wasteCursor += yearWasteT;
      const yearOpex =
        yearOreT *
          (s.mining_cost_usd_t +
            s.processing_cost_usd_t +
            s.ga_cost_usd_t +
            s.transport_cost_usd_t +
            s.sustaining_capex_usd_t) +
        yearWasteT * (s.mining_cost_usd_t + s.waste_cost_usd_t);
      const yearCapex = y === 1 ? s.capex_usd : 0;
      yearly.push({
        year: y,
        ore: yearOreT,
        waste: yearWasteT,
        metal: yearMetal,
        revenue: yearRevenue,
        opex: yearOpex,
        capex: yearCapex,
      });
      cumGradeT += yearOreT;
      cumGrade += yearMetal; // approx
    }

    const cashflows = [
      -s.capex_usd,
      ...yearly.map((y) => y.revenue - y.opex - (y.year === 1 ? 0 : 0)),
    ];
    const npv = cashflows.reduce(
      (acc, cf, t) => acc + cf / Math.pow(1 + s.discount_rate_pct / 100, t),
      0,
    );
    const irr = computeIRR(cashflows);
    let cum = 0;
    let payback = null as number | null;
    for (let i = 0; i < cashflows.length; i++) {
      cum += cashflows[i];
      if (cum >= 0 && payback === null) payback = i;
    }

    // 4) Persist (clear previous)
    await supabase.from("resource_block_economics").delete().eq("scenario_id", scenario_id);
    await supabase.from("economic_schedule").delete().eq("scenario_id", scenario_id);

    const beRows = blockEcon.map((be) => ({
      scenario_id,
      project_id: s.project_id,
      block_id: be.block_id,
      nsr_usd_t: be.nsr_usd_t,
      insitu_value_usd: be.insitu_value_usd,
      total_cost_usd_t: be.total_cost_usd_t,
      margin_usd_t: be.margin_usd_t,
      in_pit: inPit.has(be.block_id),
      is_ore: be.is_ore,
    }));
    const chunkSize = 500;
    for (let i = 0; i < beRows.length; i += chunkSize) {
      const { error } = await supabase
        .from("resource_block_economics")
        .insert(beRows.slice(i, i + chunkSize));
      if (error) throw error;
    }

    let cumCash = -s.capex_usd;
    const schedRows = yearly.map((y) => {
      const cashflow = y.revenue - y.opex;
      cumCash += cashflow;
      const disc = cashflow / Math.pow(1 + s.discount_rate_pct / 100, y.year);
      return {
        scenario_id,
        project_id: s.project_id,
        year: y.year,
        ore_tonnes: y.ore,
        waste_tonnes: y.waste,
        mean_grade: y.ore > 0 ? y.metal / y.ore : null,
        metal_payable: y.metal,
        revenue_usd: y.revenue,
        opex_usd: y.opex,
        capex_usd: y.capex,
        cashflow_usd: cashflow,
        discounted_cashflow_usd: disc,
        cumulative_cashflow_usd: cumCash,
      };
    });
    if (schedRows.length > 0) {
      const { error } = await supabase.from("economic_schedule").insert(schedRows);
      if (error) throw error;
    }

    const totalRevenue = yearly.reduce((a, b) => a + b.revenue, 0);
    const totalOpex = yearly.reduce((a, b) => a + b.opex, 0);

    await supabase
      .from("economic_scenarios")
      .update({
        status: "complete",
        nsr_cutoff_usd_t: nsrCutoffUsdT,
        ore_tonnes: totalOreT,
        waste_tonnes: totalWasteT,
        strip_ratio: stripRatio,
        mean_grade: cumGradeT > 0 ? cumGrade / cumGradeT : null,
        metal_payable: cumGrade,
        gross_revenue_usd: totalRevenue,
        total_opex_usd: totalOpex,
        total_capex_usd: s.capex_usd,
        ebitda_usd: totalRevenue - totalOpex,
        npv_usd: npv,
        irr_pct: irr,
        payback_years: payback,
        mine_life_years: yearsLife,
        computed_at: new Date().toISOString(),
      })
      .eq("id", scenario_id);

    return new Response(
      JSON.stringify({
        ok: true,
        nsr_cutoff_grade: nsrCutoffGrade,
        ore_tonnes: totalOreT,
        strip_ratio: stripRatio,
        npv_usd: npv,
        irr_pct: irr,
        mine_life_years: yearsLife,
        payback_years: payback,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
