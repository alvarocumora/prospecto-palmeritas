// Cliente del mining-engine (FastAPI en Railway).
// /desurvey: convierte collar + survey shots en trayectoria 3D real.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Shot = { depth: number; azimuth: number; dip: number };
type TrajPoint = { md: number; x: number; y: number; z: number };

function engineBase(): string {
  const url = process.env.MINING_ENGINE_URL;
  if (!url) throw new Error("MINING_ENGINE_URL no configurada");
  return url.replace(/\/+$/, "");
}

async function callDesurvey(payload: {
  collar_x: number;
  collar_y: number;
  collar_z: number;
  shots: Shot[];
  step?: number;
}): Promise<{ points: TrajPoint[]; total_length: number }> {
  const token = process.env.MINING_ENGINE_TOKEN;
  const r = await fetch(`${engineBase()}/desurvey`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ step: 5, ...payload }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`mining-engine /desurvey ${r.status}: ${txt}`);
  return JSON.parse(txt) as { points: TrajPoint[]; total_length: number };
}

// ---------------------------------------------------------------------------
// /composite — length-weighted compositing
// ---------------------------------------------------------------------------
type CompositeOut = {
  composites: Array<{
    from: number;
    to: number;
    length: number;
    recovery: number;
    values: Record<string, number | null>;
  }>;
  count: number;
};

async function callComposite(payload: {
  intervals: Array<{ from: number; to: number; values: Record<string, number | null> }>;
  length: number;
  start?: number;
  end?: number;
  min_recovery?: number;
}): Promise<CompositeOut> {
  const token = process.env.MINING_ENGINE_TOKEN;
  const r = await fetch(`${engineBase()}/composite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`mining-engine /composite ${r.status}: ${txt}`);
  return JSON.parse(txt) as CompositeOut;
}

// compositeHole: lee drill_core_logs y devuelve compuestos en memoria.
// Variables compuestas: au_gpt, ag_gpt, cu_pct (las que tengan dato).
export const compositeHole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        holeId: z.string().uuid(),
        length: z.number().gt(0).lte(50).default(1),
        minRecovery: z.number().min(0).max(1).default(0.5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: logs, error } = await supabase
      .from("drill_core_logs")
      .select("depth_from,depth_to,au_gpt,ag_gpt,cu_pct")
      .eq("hole_id", data.holeId)
      .order("depth_from", { ascending: true });
    if (error) throw new Error(error.message);
    if (!logs || logs.length === 0) {
      return { composites: [], count: 0, source_intervals: 0 };
    }

    const intervals = logs.map((l) => ({
      from: Number(l.depth_from),
      to: Number(l.depth_to),
      values: {
        au_gpt: l.au_gpt == null ? null : Number(l.au_gpt),
        ag_gpt: l.ag_gpt == null ? null : Number(l.ag_gpt),
        cu_pct: l.cu_pct == null ? null : Number(l.cu_pct),
      },
    }));

    const out = await callComposite({
      intervals,
      length: data.length,
      min_recovery: data.minRecovery,
    });
    return { ...out, source_intervals: logs.length };
  });

// ---------------------------------------------------------------------------
// /section — corte vertical arbitrario sobre sondajes de un proyecto
// ---------------------------------------------------------------------------
type SectionTrajOut = {
  hole_id: string;
  hole_code: string | null;
  points: Array<{ md: number; s: number; h: number; d: number; in_band: boolean }>;
  intercepts: Array<Record<string, number | string | null>>;
};
type SectionOut = {
  azimuth_deg: number;
  band_m: number;
  trajectories: SectionTrajOut[];
  extra_points: Array<Record<string, number | string | null>>;
  bounds: { s_min: number; s_max: number; h_min: number; h_max: number };
};

export const sectionProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        origin_x: z.number(),
        origin_y: z.number(),
        origin_z: z.number().default(0),
        azimuth_deg: z.number().min(0).max(360),
        band_m: z.number().gt(0).lte(2000).default(50),
        modelId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SectionOut> => {
    const { supabase } = context;
    const { data: holes, error } = await supabase
      .from("drill_holes")
      .select("id,hole_id")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    const holeIds = (holes ?? []).map((h) => h.id);

    let trajectories: Array<{
      hole_id: string;
      hole_code: string | null;
      points: Array<{ md: number; x: number; y: number; z: number }>;
    }> = [];
    if (holeIds.length > 0) {
      const { data: trajRows } = await supabase
        .from("drill_hole_trajectories")
        .select("hole_id,points")
        .in("hole_id", holeIds);
      trajectories = (trajRows ?? []).map((t) => {
        const meta = holes!.find((h) => h.id === t.hole_id);
        return {
          hole_id: t.hole_id,
          hole_code: meta?.hole_id ?? null,
          points:
            (t.points as Array<{ md: number; x: number; y: number; z: number }>) ?? [],
        };
      });
    }

    // Bloques estimados (opcional) — se proyectan como extra_points con kind=block
    let extraPoints: Array<Record<string, number | string | null>> = [];
    if (data.modelId) {
      const { data: blocks } = await supabase
        .from("resource_blocks")
        .select("x,y,z,grade")
        .eq("model_id", data.modelId)
        .not("grade", "is", null)
        .limit(8000);
      extraPoints = (blocks ?? []).map((b) => ({
        kind: "block",
        x: Number(b.x),
        y: Number(b.y),
        z: Number(b.z),
        grade: b.grade == null ? null : Number(b.grade),
      }));
    }

    if (trajectories.length === 0 && extraPoints.length === 0) {
      return {
        azimuth_deg: data.azimuth_deg,
        band_m: data.band_m,
        trajectories: [],
        extra_points: [],
        bounds: { s_min: 0, s_max: 0, h_min: 0, h_max: 0 },
      };
    }

    const token = process.env.MINING_ENGINE_TOKEN;
    const r = await fetch(`${engineBase()}/section`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        origin_x: data.origin_x,
        origin_y: data.origin_y,
        origin_z: data.origin_z,
        azimuth_deg: data.azimuth_deg,
        band_m: data.band_m,
        trajectories,
        extra_points: extraPoints,
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`mining-engine /section ${r.status}: ${txt}`);
    return JSON.parse(txt) as SectionOut;
  });

// ---------------------------------------------------------------------------
// saveWireframe — persiste la malla RBF en geology_wireframes
// ---------------------------------------------------------------------------
export const saveWireframe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(200),
        commodity: z.string().max(10).nullable().optional(),
        iso: z.number().min(0).max(1),
        smooth: z.number().min(0).max(1000),
        grid_n: z.number().int().min(8).max(80),
        pad: z.number().min(0).max(1000),
        samples_used: z.number().int().nullable().optional(),
        volume_m3: z.number().nullable().optional(),
        vertices: z.array(z.array(z.number()).length(3)),
        faces: z.array(z.array(z.number().int()).length(3)),
        bbox: z
          .object({
            min: z.array(z.number()).length(3),
            max: z.array(z.number()).length(3),
          })
          .nullable()
          .optional(),
        origin_lng: z.number().nullable().optional(),
        origin_lat: z.number().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("geology_wireframes")
      .insert({
        project_id: data.projectId,
        name: data.name,
        commodity: data.commodity ?? null,
        iso: data.iso,
        smooth: data.smooth,
        grid_n: data.grid_n,
        pad: data.pad,
        samples_used: data.samples_used ?? null,
        volume_m3: data.volume_m3 ?? null,
        vertices: data.vertices,
        faces: data.faces,
        bbox: data.bbox ?? null,
        origin_lng: data.origin_lng ?? null,
        origin_lat: data.origin_lat ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// ---------------------------------------------------------------------------
// /wireframe-rbf — superficie implícita para indicador binario (ore/waste)
// ---------------------------------------------------------------------------
export const wireframeFromComposites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        samples: z
          .array(
            z.object({
              x: z.number(),
              y: z.number(),
              z: z.number(),
              indicator: z.number().min(0).max(1),
            }),
          )
          .min(4),
        iso: z.number().min(0).max(1).default(0.5),
        grid_n: z.number().int().min(8).max(80).default(32),
        pad: z.number().min(0).max(1000).default(50),
        smooth: z.number().min(0).max(1000).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = process.env.MINING_ENGINE_TOKEN;
    const r = await fetch(`${engineBase()}/wireframe-rbf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`mining-engine /wireframe-rbf ${r.status}: ${txt}`);
    return JSON.parse(txt) as {
      status: string;
      vertices: number[][];
      faces: number[][];
      bbox?: { min: number[]; max: number[] };
      volume_m3?: number;
      samples_used?: number;
      iso?: number;
      grid_n?: number;
    };
  });

// ---------------------------------------------------------------------------
// /swath-plot — validación visual compositos vs bloques estimados
// ---------------------------------------------------------------------------
export const swathPlotForModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        modelId: z.string().uuid(),
        axis: z.enum(["x", "y", "z"]).default("z"),
        n_bands: z.number().int().min(5).max(100).default(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: blocks, error: bErr } = await supabase
      .from("resource_blocks")
      .select("x,y,z,grade")
      .eq("model_id", data.modelId)
      .not("grade", "is", null)
      .limit(10000);
    if (bErr) throw new Error(bErr.message);

    // Compositos: drill_core_logs georef via collares — promediamos con elevation.
    const { data: model } = await supabase
      .from("resource_models")
      .select("project_id,commodity")
      .eq("id", data.modelId)
      .maybeSingle();
    if (!model) throw new Error("modelo no encontrado");

    const valueCol =
      model.commodity === "au" ? "au_gpt" : model.commodity === "ag" ? "ag_gpt" : "cu_pct";

    const { data: comp } = await supabase
      .from("drill_core_logs")
      .select(
        `depth_from,depth_to,${valueCol},drill_holes!inner(easting,northing,elevation,project_id)`,
      )
      .eq("drill_holes.project_id", model.project_id)
      .not(valueCol, "is", null)
      .limit(20000);

    const composites = (comp ?? []).map((row: Record<string, unknown>) => {
      const h = row.drill_holes as { easting: number; northing: number; elevation: number };
      const mid = (Number(row.depth_from) + Number(row.depth_to)) / 2;
      return {
        x: Number(h.easting),
        y: Number(h.northing),
        z: Number(h.elevation) - mid,
        grade: Number(row[valueCol]),
      };
    });

    const token = process.env.MINING_ENGINE_TOKEN;
    const r = await fetch(`${engineBase()}/swath-plot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        composites,
        blocks: (blocks ?? []).map((b) => ({
          x: Number(b.x),
          y: Number(b.y),
          z: Number(b.z),
          grade: Number(b.grade),
        })),
        axis: data.axis,
        n_bands: data.n_bands,
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`mining-engine /swath-plot ${r.status}: ${txt}`);
    return JSON.parse(txt) as {
      axis: string;
      bands: Array<{
        center: number;
        low: number;
        high: number;
        n_composites: number;
        n_blocks: number;
        mean_composites: number | null;
        mean_blocks: number | null;
      }>;
    };
  });

// ---------------------------------------------------------------------------
// Diagnóstico (página /diag/mining-engine)
// ---------------------------------------------------------------------------
export const testMiningEngine = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.MINING_ENGINE_URL;
  const token = process.env.MINING_ENGINE_TOKEN;
  if (!url) return { ok: false, error: "MINING_ENGINE_URL no configurada" };

  const base = url.replace(/\/+$/, "");
  const results: Record<string, unknown> = { base, has_token: Boolean(token) };

  try {
    const r = await fetch(`${base}/health`);
    results.health = { status: r.status, body: await r.json() };
  } catch (e) {
    results.health = { error: String(e) };
  }

  try {
    const out = await callDesurvey({
      collar_x: 0,
      collar_y: 0,
      collar_z: 100,
      shots: [
        { depth: 0, azimuth: 90, dip: -60 },
        { depth: 50, azimuth: 92, dip: -62 },
        { depth: 100, azimuth: 95, dip: -65 },
      ],
      step: 5,
    });
    results.desurvey = { status: 200, points: out.points.length, total: out.total_length };
  } catch (e) {
    results.desurvey = { error: String(e) };
  }

  return { ok: true, ...results };
});

// Diagnóstico /composite: toma el hole con más drill_core_logs y compone.
export const testCompositeEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: logs, error } = await supabase
      .from("drill_core_logs")
      .select("hole_id,depth_from,depth_to,au_gpt,ag_gpt,cu_pct")
      .order("depth_from", { ascending: true })
      .limit(5000);
    if (error) throw new Error(error.message);
    if (!logs || logs.length === 0) {
      return { ok: false, error: "Sin drill_core_logs en la base" };
    }
    const counts = new Map<string, number>();
    for (const l of logs) counts.set(l.hole_id, (counts.get(l.hole_id) ?? 0) + 1);
    const [holeId, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const holeLogs = logs.filter((l) => l.hole_id === holeId);

    const { data: holeRow } = await supabase
      .from("drill_holes")
      .select("hole_id")
      .eq("id", holeId)
      .maybeSingle();

    const intervals = holeLogs.map((l) => ({
      from: Number(l.depth_from),
      to: Number(l.depth_to),
      values: {
        au_gpt: l.au_gpt == null ? null : Number(l.au_gpt),
        ag_gpt: l.ag_gpt == null ? null : Number(l.ag_gpt),
        cu_pct: l.cu_pct == null ? null : Number(l.cu_pct),
      },
    }));

    const t0 = Date.now();
    try {
      const out = await callComposite({ intervals, length: 2, min_recovery: 0.5 });
      return {
        ok: true,
        hole_id: holeId,
        hole_code: holeRow?.hole_id ?? null,
        source_intervals: n,
        composites_count: out.count,
        elapsed_ms: Date.now() - t0,
        sample: out.composites.slice(0, 5),
      };
    } catch (e) {
      return {
        ok: false,
        hole_id: holeId,
        hole_code: holeRow?.hole_id ?? null,
        source_intervals: n,
        elapsed_ms: Date.now() - t0,
        error: String(e),
      };
    }
  });

// ---------------------------------------------------------------------------
// computeHoleTrajectory: desurvey + persistencia en drill_hole_trajectories.
// Si el hole tiene <2 survey shots, sintetiza dos desde collar (az/dip) hasta
// profundidad real/planificada — trayectoria recta georeferenciada.
// ---------------------------------------------------------------------------
export const computeHoleTrajectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ holeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: hole, error: hErr } = await supabase
      .from("drill_holes")
      .select(
        "id,hole_id,easting,northing,elevation,azimuth,dip,planned_depth,actual_depth",
      )
      .eq("id", data.holeId)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!hole) throw new Error("Sondaje no encontrado");
    if (hole.easting == null || hole.northing == null) {
      throw new Error("El sondaje requiere easting/northing (collar)");
    }

    const { data: surveyRows, error: sErr } = await supabase
      .from("drill_hole_surveys")
      .select("depth,azimuth,dip")
      .eq("hole_id", hole.id)
      .order("depth", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    const total = Number(hole.actual_depth ?? hole.planned_depth ?? 0);
    let shots: Shot[] = (surveyRows ?? []).map((r) => ({
      depth: Number(r.depth),
      azimuth: Number(r.azimuth),
      dip: Number(r.dip),
    }));

    if (shots.length < 2) {
      if (total <= 0) {
        throw new Error(
          "Necesitas profundidad (planificada o real) o ≥2 survey shots para desurveyar",
        );
      }
      if (hole.azimuth == null || hole.dip == null) {
        throw new Error("Sin surveys, el sondaje requiere azimuth y dip de collar");
      }
      shots = [
        { depth: 0, azimuth: Number(hole.azimuth), dip: Number(hole.dip) },
        { depth: total, azimuth: Number(hole.azimuth), dip: Number(hole.dip) },
      ];
    }

    const result = await callDesurvey({
      collar_x: Number(hole.easting),
      collar_y: Number(hole.northing),
      collar_z: Number(hole.elevation ?? 0),
      shots,
      step: 5,
    });

    const { error: uErr } = await supabase
      .from("drill_hole_trajectories")
      .upsert(
        {
          hole_id: hole.id,
          points: result.points,
          total_length: result.total_length,
          engine_version: "mining-engine@0.1.0",
          computed_at: new Date().toISOString(),
        },
        { onConflict: "hole_id" },
      );
    if (uErr) throw new Error(uErr.message);

    return {
      holeId: hole.id,
      hole_code: hole.hole_id,
      points: result.points.length,
      total_length: result.total_length,
      shots_used: shots.length,
      synthesized: (surveyRows?.length ?? 0) < 2,
    };
  });

// ---------------------------------------------------------------------------
// computeProjectTrajectories: batch para todos los sondajes con collar válido.
// ---------------------------------------------------------------------------
export const computeProjectTrajectories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: holes, error } = await supabase
      .from("drill_holes")
      .select(
        "id,hole_id,easting,northing,elevation,azimuth,dip,planned_depth,actual_depth",
      )
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);

    const eligible = (holes ?? []).filter(
      (h) =>
        h.easting != null &&
        h.northing != null &&
        (h.actual_depth || h.planned_depth) &&
        h.azimuth != null &&
        h.dip != null,
    );

    let ok = 0;
    const failures: { hole_id: string; error: string }[] = [];

    for (const hole of eligible) {
      try {
        const { data: surveyRows } = await supabase
          .from("drill_hole_surveys")
          .select("depth,azimuth,dip")
          .eq("hole_id", hole.id)
          .order("depth", { ascending: true });

        const total = Number(hole.actual_depth ?? hole.planned_depth ?? 0);
        let shots: Shot[] = (surveyRows ?? []).map((r) => ({
          depth: Number(r.depth),
          azimuth: Number(r.azimuth),
          dip: Number(r.dip),
        }));
        if (shots.length < 2) {
          shots = [
            { depth: 0, azimuth: Number(hole.azimuth), dip: Number(hole.dip) },
            { depth: total, azimuth: Number(hole.azimuth), dip: Number(hole.dip) },
          ];
        }

        const result = await callDesurvey({
          collar_x: Number(hole.easting),
          collar_y: Number(hole.northing),
          collar_z: Number(hole.elevation ?? 0),
          shots,
          step: 5,
        });

        await supabase.from("drill_hole_trajectories").upsert(
          {
            hole_id: hole.id,
            points: result.points,
            total_length: result.total_length,
            engine_version: "mining-engine@0.1.0",
            computed_at: new Date().toISOString(),
          },
          { onConflict: "hole_id" },
        );
        ok += 1;
      } catch (e) {
        failures.push({ hole_id: hole.hole_id, error: String(e) });
      }
    }

    return {
      attempted: eligible.length,
      total_holes: (holes ?? []).length,
      succeeded: ok,
      failed: failures.length,
      failures,
    };
  });
