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
