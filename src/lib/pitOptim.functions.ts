// Pit Optimization — floating-cone heuristic con restricción de slope.
// Lee un escenario económico + bloques del modelo, computa valor por bloque
// y resuelve un pit shell aproximado. Persiste resource_block_economics y
// actualiza KPIs en economic_scenarios.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAMS_PER_OZ = 31.1034768;
const LB_PER_T = 2204.622621;

type Block = {
  id: string;
  ix: number;
  iy: number;
  iz: number;
  x: number;
  y: number;
  z: number;
  grade: number | null;
};

type Scenario = {
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
  sustaining_capex_usd_t: number;
};

type Model = {
  id: string;
  commodity: string;
  density_t_m3: number;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
};

// Convierte la ley a metal pagable por tonelada (oz/t o lb/t según price_unit).
function payableMetalPerT(
  grade: number,
  commodity: string,
  priceUnit: string,
  recoveryPct: number,
  payablePct: number,
): number {
  const rec = recoveryPct / 100;
  const pay = payablePct / 100;
  if (priceUnit === "usd_per_oz") {
    // grade es g/t → oz/t
    return (grade / GRAMS_PER_OZ) * rec * pay;
  }
  if (priceUnit === "usd_per_lb") {
    // grade es % → lb/t
    return (grade / 100) * LB_PER_T * rec * pay;
  }
  // usd_per_t: grade es % → t/t
  // Si commodity es metal base donde grade es %
  if (commodity === "fe" || commodity === "li") {
    return (grade / 100) * rec * pay;
  }
  return grade * rec * pay;
}

// Calcula valor económico por bloque.
// Devuelve { tonnage, payable, nsr_per_t, value_per_t (ore), value_total }.
function blockEconomics(b: Block, m: Model, s: Scenario) {
  const tonnage = m.block_size_x * m.block_size_y * m.block_size_z * m.density_t_m3;
  const wasteValue = -s.waste_cost_usd_t * tonnage;

  if (b.grade == null || b.grade <= 0) {
    return {
      tonnage,
      payable: 0,
      nsr_per_t: 0,
      total_cost_per_t: s.waste_cost_usd_t,
      margin_per_t: -s.waste_cost_usd_t,
      ore_value_total: wasteValue,
      is_ore: false,
      value: wasteValue,
    };
  }

  const payable = payableMetalPerT(
    Number(b.grade),
    m.commodity,
    s.price_unit,
    s.recovery_pct,
    s.payable_pct,
  );

  // Ingreso bruto por tonelada
  let revenuePerT = payable * s.commodity_price_usd;
  // Refining (solo en usd_per_oz)
  if (s.price_unit === "usd_per_oz") {
    revenuePerT -= payable * s.refining_cost_usd_oz;
  }
  // Royalty sobre revenue
  const royalty = revenuePerT * (s.royalty_pct / 100);

  const opex =
    s.mining_cost_usd_t +
    s.processing_cost_usd_t +
    s.ga_cost_usd_t +
    s.transport_cost_usd_t +
    s.sustaining_capex_usd_t;

  const nsrPerT = revenuePerT - royalty;
  const marginPerT = nsrPerT - opex;
  const oreValueTotal = marginPerT * tonnage;

  // Decisión ore vs waste: si margen como ore > -waste_cost, es ore
  const isOre = marginPerT > -s.waste_cost_usd_t;
  const value = isOre ? oreValueTotal : wasteValue;

  return {
    tonnage,
    payable,
    nsr_per_t: nsrPerT,
    total_cost_per_t: isOre ? opex : s.waste_cost_usd_t,
    margin_per_t: isOre ? marginPerT : -s.waste_cost_usd_t,
    ore_value_total: oreValueTotal,
    is_ore: isOre,
    value,
  };
}

type Econ = ReturnType<typeof blockEconomics>;

// Floating-cone: para cada bloque ore-positivo (top→bottom), construye su
// cono de remoción (bloques arriba dentro del slope) y, si el valor neto del
// cono es positivo, los marca como in_pit. Itera hasta convergencia.
function floatingCone(
  blocks: Block[],
  econ: Econ[],
  m: Model,
  slopeDeg: number,
): boolean[] {
  const n = blocks.length;
  const inPit = new Array<boolean>(n).fill(false);
  const tan = Math.tan((slopeDeg * Math.PI) / 180);
  if (!isFinite(tan) || tan <= 0) return inPit;

  const dx = m.block_size_x;
  const dy = m.block_size_y;
  const dz = m.block_size_z;

  // Index por (ix,iy) para cada nivel iz
  const byIz = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const k = blocks[i].iz;
    const arr = byIz.get(k) ?? [];
    arr.push(i);
    byIz.set(k, arr);
  }
  const izLevels = [...byIz.keys()].sort((a, b) => b - a); // top→bottom
  const maxIz = izLevels[0];

  // Para cada bloque, precomputar la lista de índices de su cono.
  // Cono: todos los bloques con iz' > iz tales que sqrt((dx·Δix)²+(dy·Δiy)²)
  //       <= (iz'-iz)·dz / tan(slope)
  function coneOf(idx: number): number[] {
    const b = blocks[idx];
    const out: number[] = [];
    for (let k = b.iz + 1; k <= maxIz; k++) {
      const depthAbove = (k - b.iz) * dz;
      const radius = depthAbove / tan;
      const ixsAtK = byIz.get(k);
      if (!ixsAtK) continue;
      for (const j of ixsAtK) {
        const bj = blocks[j];
        const dX = (bj.ix - b.ix) * dx;
        const dY = (bj.iy - b.iy) * dy;
        if (Math.hypot(dX, dY) <= radius + 1e-6) out.push(j);
      }
    }
    return out;
  }

  // Procesar candidatos: bloques con value > 0 (ore profit), de top a bottom
  const candidates: number[] = [];
  for (const k of izLevels) {
    const ixs = byIz.get(k)!;
    for (const i of ixs) {
      if (econ[i].is_ore && econ[i].value > 0) candidates.push(i);
    }
  }

  let changed = true;
  let safety = 0;
  while (changed && safety < 6) {
    changed = false;
    safety++;
    for (const i of candidates) {
      if (inPit[i]) continue;
      const cone = coneOf(i);
      // valor neto = bloque + cono (excluyendo los ya in_pit)
      let net = econ[i].value;
      const toAdd: number[] = [i];
      for (const j of cone) {
        if (inPit[j]) continue;
        net += econ[j].value;
        toAdd.push(j);
      }
      if (net > 0) {
        for (const j of toAdd) inPit[j] = true;
        changed = true;
      }
    }
  }
  return inPit;
}

export const optimizePit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scenarioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t0 = Date.now();

    const { data: scenarioRow, error: sErr } = await supabase
      .from("economic_scenarios")
      .select(
        "id,project_id,model_id,commodity_price_usd,price_unit,recovery_pct,payable_pct,mining_cost_usd_t,processing_cost_usd_t,ga_cost_usd_t,waste_cost_usd_t,royalty_pct,refining_cost_usd_oz,transport_cost_usd_t,slope_angle_deg,sustaining_capex_usd_t",
      )
      .eq("id", data.scenarioId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!scenarioRow) throw new Error("Escenario no encontrado");
    const scenario = scenarioRow as unknown as Scenario;

    const { data: modelRow, error: mErr } = await supabase
      .from("resource_models")
      .select("id,commodity,density_t_m3,block_size_x,block_size_y,block_size_z")
      .eq("id", scenario.model_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!modelRow) throw new Error("Modelo no encontrado");
    const model = modelRow as unknown as Model;

    // Lee bloques en chunks (Supabase default 1000)
    const blocks: Block[] = [];
    let from = 0;
    const chunk = 1000;
    for (;;) {
      const { data: rows, error: bErr } = await supabase
        .from("resource_blocks")
        .select("id,ix,iy,iz,x,y,z,grade")
        .eq("model_id", model.id)
        .order("iz", { ascending: true })
        .range(from, from + chunk - 1);
      if (bErr) throw new Error(bErr.message);
      if (!rows || rows.length === 0) break;
      for (const r of rows) {
        blocks.push({
          id: r.id,
          ix: Number(r.ix),
          iy: Number(r.iy),
          iz: Number(r.iz),
          x: Number(r.x),
          y: Number(r.y),
          z: Number(r.z),
          grade: r.grade == null ? null : Number(r.grade),
        });
      }
      if (rows.length < chunk) break;
      from += chunk;
    }
    if (!blocks.length) throw new Error("Modelo sin bloques");

    // Economía por bloque
    const econ = blocks.map((b) => blockEconomics(b, model, scenario));

    // Floating cone
    const inPit = floatingCone(blocks, econ, model, Number(scenario.slope_angle_deg));

    // KPIs
    let oreTon = 0,
      wasteTon = 0,
      revenue = 0,
      gradeSum = 0,
      metalSum = 0,
      totalValue = 0,
      oreCount = 0,
      pitCount = 0;
    for (let i = 0; i < blocks.length; i++) {
      if (!inPit[i]) continue;
      pitCount++;
      const e = econ[i];
      totalValue += e.value;
      if (e.is_ore) {
        oreTon += e.tonnage;
        oreCount++;
        const g = blocks[i].grade ?? 0;
        gradeSum += g * e.tonnage;
        metalSum += e.payable * e.tonnage;
        revenue += e.nsr_per_t * e.tonnage;
      } else {
        wasteTon += e.tonnage;
      }
    }
    const stripRatio = oreTon > 0 ? wasteTon / oreTon : 0;
    const meanGrade = oreTon > 0 ? gradeSum / oreTon : 0;

    // Persistir economía por bloque (upsert por scenario_id+block_id)
    // Por límites de tamaño, sube en lotes de 500.
    const econRows = blocks.map((b, i) => ({
      scenario_id: scenario.id,
      project_id: scenario.project_id,
      block_id: b.id,
      nsr_usd_t: Number(econ[i].nsr_per_t.toFixed(4)),
      insitu_value_usd: Number(econ[i].value.toFixed(2)),
      total_cost_usd_t: Number(econ[i].total_cost_per_t.toFixed(4)),
      margin_usd_t: Number(econ[i].margin_per_t.toFixed(4)),
      in_pit: inPit[i],
      is_ore: inPit[i] && econ[i].is_ore,
    }));

    let persisted = 0;
    for (let s = 0; s < econRows.length; s += 500) {
      const batch = econRows.slice(s, s + 500);
      const { error: upErr } = await supabase
        .from("resource_block_economics")
        .upsert(batch, { onConflict: "scenario_id,block_id" });
      if (upErr) throw new Error(`upsert economics: ${upErr.message}`);
      persisted += batch.length;
    }

    // Actualizar KPIs del escenario
    const { error: updErr } = await supabase
      .from("economic_scenarios")
      .update({
        ore_tonnes: oreTon,
        waste_tonnes: wasteTon,
        strip_ratio: stripRatio,
        mean_grade: meanGrade,
        metal_payable: metalSum,
        gross_revenue_usd: revenue,
        status: "pit_optimized",
        computed_at: new Date().toISOString(),
      } as never)
      .eq("id", scenario.id);
    if (updErr) throw new Error(`update scenario: ${updErr.message}`);

    return {
      ok: true,
      scenario_id: scenario.id,
      model_id: model.id,
      blocks_total: blocks.length,
      blocks_in_pit: pitCount,
      blocks_ore: oreCount,
      ore_tonnes: oreTon,
      waste_tonnes: wasteTon,
      strip_ratio: stripRatio,
      mean_grade: meanGrade,
      metal_payable: metalSum,
      gross_revenue_usd: revenue,
      total_pit_value_usd: totalValue,
      slope_angle_deg: scenario.slope_angle_deg,
      persisted_block_econ: persisted,
      elapsed_ms: Date.now() - t0,
    };
  });

// Diagnóstico: corre pit-optim sobre el escenario más reciente con bloques.
export const testPitOptim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: scenarios, error } = await supabase
      .from("economic_scenarios")
      .select("id,name,model_id,project_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    if (!scenarios?.length) return { ok: false, error: "Sin escenarios económicos" };

    // Filtra a los que tengan bloques estimados
    for (const sc of scenarios) {
      const { count } = await supabase
        .from("resource_blocks")
        .select("id", { count: "exact", head: true })
        .eq("model_id", sc.model_id)
        .not("grade", "is", null);
      if ((count ?? 0) > 0) {
        const out = await optimizePit({ data: { scenarioId: sc.id } });
        return { scenario_name: sc.name, ...out };
      }
    }
    return { ok: false, error: "Ningún escenario tiene bloques estimados" };
  });
