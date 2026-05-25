// Sub-sprint Scheduling NPV anual — secuencia bloques in-pit por bancos
// (de arriba hacia abajo) y, dentro de cada banco, por mayor margen primero.
// Empaca producción según annual_throughput_t, descuenta cashflow y
// persiste tabla economic_schedule + KPIs NPV/IRR/payback/mine_life.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Scenario = {
  id: string;
  project_id: string;
  model_id: string;
  annual_throughput_t: number;
  discount_rate_pct: number;
  ramp_up_years: number;
  capex_usd: number;
  ga_cost_usd_t: number;
  sustaining_capex_usd_t: number;
};

type Model = {
  id: string;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
  density_t_m3: number;
  commodity: string;
};

type BlockEcon = {
  block_id: string;
  in_pit: boolean;
  is_ore: boolean;
  margin_usd_t: number;
  nsr_usd_t: number;
  insitu_value_usd: number;
  // join
  iz: number;
  grade: number | null;
};

// IRR por bisección sobre cashflows anuales (year 0 = capex)
function computeIRR(cashflows: number[]): number | null {
  const npv = (r: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  let lo = -0.99,
    hi = 5,
    npvLo = npv(lo),
    npvHi = npv(hi);
  if (npvLo * npvHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1) return mid;
    if (v * npvLo < 0) {
      hi = mid;
      npvHi = v;
    } else {
      lo = mid;
      npvLo = v;
    }
  }
  return (lo + hi) / 2;
}

export const scheduleScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scenarioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t0 = Date.now();

    const { data: scRow, error: sErr } = await supabase
      .from("economic_scenarios")
      .select(
        "id,project_id,model_id,annual_throughput_t,discount_rate_pct,ramp_up_years,capex_usd,ga_cost_usd_t,sustaining_capex_usd_t",
      )
      .eq("id", data.scenarioId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!scRow) throw new Error("Escenario no encontrado");
    const sc = scRow as unknown as Scenario;

    const { data: modelRow, error: mErr } = await supabase
      .from("resource_models")
      .select("id,commodity,density_t_m3,block_size_x,block_size_y,block_size_z")
      .eq("id", sc.model_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!modelRow) throw new Error("Modelo no encontrado");
    const model = modelRow as unknown as Model;

    // Lee block economics in_pit con join a resource_blocks (iz, grade)
    const econ: BlockEcon[] = [];
    let from = 0;
    const chunk = 1000;
    for (;;) {
      const { data: rows, error } = await supabase
        .from("resource_block_economics")
        .select(
          "block_id,in_pit,is_ore,margin_usd_t,nsr_usd_t,insitu_value_usd,resource_blocks(iz,grade)",
        )
        .eq("scenario_id", sc.id)
        .eq("in_pit", true)
        .range(from, from + chunk - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows as unknown as Array<
        BlockEcon & { resource_blocks?: { iz: number; grade: number | null } }
      >) {
        const rb = (r as { resource_blocks?: { iz: number; grade: number | null } })
          .resource_blocks;
        econ.push({
          block_id: r.block_id,
          in_pit: r.in_pit,
          is_ore: r.is_ore,
          margin_usd_t: Number(r.margin_usd_t ?? 0),
          nsr_usd_t: Number(r.nsr_usd_t ?? 0),
          insitu_value_usd: Number(r.insitu_value_usd ?? 0),
          iz: Number(rb?.iz ?? 0),
          grade: rb?.grade == null ? null : Number(rb.grade),
        });
      }
      if (rows.length < chunk) break;
      from += chunk;
    }
    if (!econ.length)
      throw new Error("Sin bloques in-pit. Corre 'Optimizar pit' primero.");

    const tBlock =
      model.block_size_x * model.block_size_y * model.block_size_z * model.density_t_m3;

    // Orden minero: bancos top→bottom; dentro de cada banco, mayor margen primero
    econ.sort((a, b) => {
      if (b.iz !== a.iz) return b.iz - a.iz;
      return b.margin_usd_t - a.margin_usd_t;
    });

    // Empaque anual
    const throughput = Math.max(1, Number(sc.annual_throughput_t));
    type Year = {
      year: number;
      ore_t: number;
      waste_t: number;
      metal_kg_equiv: number;
      grade_w_sum: number;
      revenue: number;
      opex: number;
      capex: number;
    };
    const years: Year[] = [];
    let cur: Year = newYear(1);
    function newYear(n: number): Year {
      return {
        year: n,
        ore_t: 0,
        waste_t: 0,
        metal_kg_equiv: 0,
        grade_w_sum: 0,
        revenue: 0,
        opex: 0,
        capex: 0,
      };
    }

    // Capex año 0 (preproducción)
    const y0: Year = { ...newYear(0), capex: Number(sc.capex_usd) };
    years.push(y0);

    for (const b of econ) {
      // El bloque ocupa "tBlock" toneladas movidas. Si es ore, suma a ore_t (capacidad de planta).
      // Waste no consume capacidad de proceso pero se mueve igual.
      if (b.is_ore) {
        if (cur.ore_t + tBlock > throughput && cur.ore_t > 0) {
          years.push(cur);
          cur = newYear(cur.year + 1);
        }
        cur.ore_t += tBlock;
        const grade = b.grade ?? 0;
        cur.grade_w_sum += grade * tBlock;
        cur.revenue += b.nsr_usd_t * tBlock;
        cur.opex += -b.margin_usd_t * tBlock + b.nsr_usd_t * tBlock; // opex = nsr - margin
        // sustaining capex anual proporcional a ore
        cur.capex += Number(sc.sustaining_capex_usd_t) * tBlock;
      } else {
        cur.waste_t += tBlock;
        // costo waste se refleja vía margen negativo del bloque
        cur.opex += -b.margin_usd_t * tBlock;
      }
    }
    if (cur.ore_t > 0 || cur.waste_t > 0) years.push(cur);

    // KPIs por año
    const r = Number(sc.discount_rate_pct) / 100;
    let cumCf = 0,
      totalNpv = 0,
      paybackYears: number | null = null;
    const rows = years.map((y) => {
      const cashflow = y.revenue - y.opex - y.capex;
      const disc = cashflow / Math.pow(1 + r, y.year);
      cumCf += cashflow;
      totalNpv += disc;
      if (paybackYears == null && cumCf >= 0 && y.year > 0) paybackYears = y.year;
      const meanGrade = y.ore_t > 0 ? y.grade_w_sum / y.ore_t : null;
      return {
        scenario_id: sc.id,
        project_id: sc.project_id,
        year: y.year,
        ore_tonnes: y.ore_t,
        waste_tonnes: y.waste_t,
        mean_grade: meanGrade,
        metal_payable: 0,
        revenue_usd: Number(y.revenue.toFixed(2)),
        opex_usd: Number(y.opex.toFixed(2)),
        capex_usd: Number(y.capex.toFixed(2)),
        cashflow_usd: Number(cashflow.toFixed(2)),
        discounted_cashflow_usd: Number(disc.toFixed(2)),
        cumulative_cashflow_usd: Number(cumCf.toFixed(2)),
      };
    });

    const cashflowsForIrr = years.map((y) => y.revenue - y.opex - y.capex);
    const irr = computeIRR(cashflowsForIrr);

    // Reemplaza schedule del escenario
    const { error: delErr } = await supabase
      .from("economic_schedule")
      .delete()
      .eq("scenario_id", sc.id);
    if (delErr) throw new Error(`delete schedule: ${delErr.message}`);

    for (let s = 0; s < rows.length; s += 500) {
      const batch = rows.slice(s, s + 500);
      const { error: insErr } = await supabase.from("economic_schedule").insert(batch);
      if (insErr) throw new Error(`insert schedule: ${insErr.message}`);
    }

    const mineLife = Math.max(0, years.length - 1); // sin contar año 0
    const totalOpex = years.reduce((a, y) => a + y.opex, 0);
    const totalCapex = years.reduce((a, y) => a + y.capex, 0);
    const totalRevenue = years.reduce((a, y) => a + y.revenue, 0);

    const { error: updErr } = await supabase
      .from("economic_scenarios")
      .update({
        npv_usd: Number(totalNpv.toFixed(2)),
        irr_pct: irr == null ? null : Number((irr * 100).toFixed(2)),
        payback_years: paybackYears,
        mine_life_years: mineLife,
        total_opex_usd: Number(totalOpex.toFixed(2)),
        total_capex_usd: Number(totalCapex.toFixed(2)),
        gross_revenue_usd: Number(totalRevenue.toFixed(2)),
        ebitda_usd: Number((totalRevenue - totalOpex).toFixed(2)),
        status: "scheduled",
        computed_at: new Date().toISOString(),
      } as never)
      .eq("id", sc.id);
    if (updErr) throw new Error(`update scenario: ${updErr.message}`);

    return {
      ok: true,
      scenario_id: sc.id,
      years: rows,
      npv_usd: totalNpv,
      irr_pct: irr == null ? null : irr * 100,
      payback_years: paybackYears,
      mine_life_years: mineLife,
      total_revenue_usd: totalRevenue,
      total_opex_usd: totalOpex,
      total_capex_usd: totalCapex,
      elapsed_ms: Date.now() - t0,
    };
  });

// Diagnóstico
export const testSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: scs } = await supabase
      .from("economic_scenarios")
      .select("id,name,status")
      .eq("status", "pit_optimized")
      .order("computed_at", { ascending: false })
      .limit(1);
    if (!scs?.length) return { ok: false, error: "Sin escenarios con pit optimizado" };
    return { name: scs[0].name, ...(await scheduleScenario({ data: { scenarioId: scs[0].id } })) };
  });

// Carga bloques in_pit con economía para visualización 3D
export const fetchPitBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scenarioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: scRow, error: sErr } = await supabase
      .from("economic_scenarios")
      .select("id,model_id")
      .eq("id", data.scenarioId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!scRow) throw new Error("Escenario no encontrado");

    const { data: modelRow, error: mErr } = await supabase
      .from("resource_models")
      .select(
        "id,block_size_x,block_size_y,block_size_z,bbox_min_x,bbox_min_y,bbox_min_z,commodity",
      )
      .eq("id", scRow.model_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!modelRow) throw new Error("Modelo no encontrado");

    type Row = {
      block_id: string;
      in_pit: boolean;
      is_ore: boolean;
      margin_usd_t: number | null;
      insitu_value_usd: number | null;
      resource_blocks: { x: number; y: number; z: number; grade: number | null };
    };
    const blocks: Array<{
      id: string;
      x: number;
      y: number;
      z: number;
      grade: number | null;
      is_ore: boolean;
      margin: number;
      value: number;
    }> = [];
    let from = 0;
    const chunk = 1000;
    for (;;) {
      const { data: rows, error } = await supabase
        .from("resource_block_economics")
        .select(
          "block_id,in_pit,is_ore,margin_usd_t,insitu_value_usd,resource_blocks(x,y,z,grade)",
        )
        .eq("scenario_id", data.scenarioId)
        .eq("in_pit", true)
        .range(from, from + chunk - 1);
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows as unknown as Row[]) {
        const rb = r.resource_blocks;
        if (!rb) continue;
        blocks.push({
          id: r.block_id,
          x: Number(rb.x),
          y: Number(rb.y),
          z: Number(rb.z),
          grade: rb.grade == null ? null : Number(rb.grade),
          is_ore: r.is_ore,
          margin: Number(r.margin_usd_t ?? 0),
          value: Number(r.insitu_value_usd ?? 0),
        });
      }
      if (rows.length < chunk) break;
      from += chunk;
    }

    return {
      ok: true,
      model: {
        id: modelRow.id,
        block_size_x: Number(modelRow.block_size_x),
        block_size_y: Number(modelRow.block_size_y),
        block_size_z: Number(modelRow.block_size_z),
        commodity: modelRow.commodity,
      },
      count: blocks.length,
      blocks,
    };
  });
