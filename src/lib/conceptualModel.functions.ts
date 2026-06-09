// Server functions para generar/consultar el modelo conceptual de un proyecto.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateConceptualModel } from "./conceptualModel.server";
import proj4 from "proj4";
import { lngLatToMeters } from "@/engine3d/geospatial/crs";

proj4.defs("EPSG:32719", "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs");

const ProjectInput = z.object({ projectId: z.string().uuid() });

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
  if (error || !data) {
    throw new Response("Forbidden: super admin only", { status: 403 });
  }
}

// ─── Generador (one-shot) ───────────────────────────────────────────────────
export const generateConceptualModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjectInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const report = await generateConceptualModel({ projectId: data.projectId });
    return report;
  });

// ─── Lector: sondajes sintéticos + assays (en ENU metros) ───────────────────
export type SyntheticDrillhole = {
  id: string;
  code: string;
  collar: { x: number; y: number; z: number };
  toe: { x: number; y: number; z: number };
  azimuth: number; dip: number; depth: number;
  fromKind: string | null;
  intervals: Array<{
    from: number; to: number;
    cuPct: number; auGpt: number; agGpt: number; moPct: number;
    cuEq: number; lith: string | null; alt: string | null; mineralized: boolean;
  }>;
};
export type SyntheticHolesDataset = {
  holes: SyntheticDrillhole[];
  count: number;
  source: "synthetic" | "empty";
};

export const getSyntheticDrillholes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProjectInput.parse(d))
  .handler(async ({ data }) => {
    const projRes = await supabaseAdmin
      .from("projects").select("center_lng, center_lat").eq("id", data.projectId).maybeSingle();
    if (!projRes.data) return { holes: [], count: 0, source: "empty" as const };
    const centerLng = Number(projRes.data.center_lng);
    const centerLat = Number(projRes.data.center_lat);

    const holes = await supabaseAdmin
      .from("synthetic_drillholes")
      .select("id, hole_code, collar_x_utm, collar_y_utm, collar_z_m, azimuth_deg, dip_deg, depth_m, generated_from_kind")
      .eq("project_id", data.projectId);
    if (holes.error || !holes.data?.length) return { holes: [], count: 0, source: "empty" as const };

    const ids = holes.data.map((h) => h.id as string);
    const assays = await supabaseAdmin
      .from("synthetic_assays")
      .select("hole_id, from_m, to_m, cu_pct, au_gpt, ag_gpt, mo_pct, lithology, alteration, mineralized")
      .in("hole_id", ids);
    type AssayRowDb = {
      hole_id: string; from_m: number; to_m: number;
      cu_pct: number | null; au_gpt: number | null; ag_gpt: number | null; mo_pct: number | null;
      lithology: string | null; alteration: string | null; mineralized: boolean;
    };
    const byHole = new Map<string, AssayRowDb[]>();
    for (const a of (assays.data ?? []) as AssayRowDb[]) {
      const arr = byHole.get(a.hole_id) ?? [];
      arr.push(a);
      byHole.set(a.hole_id, arr);
    }

    const out: SyntheticDrillhole[] = holes.data.map((h) => {
      const cx = Number(h.collar_x_utm);
      const cy = Number(h.collar_y_utm);
      const cz = Number(h.collar_z_m);
      // UTM → lng/lat → ENU
      const [lng, lat] = proj4("EPSG:32719", "EPSG:4326", [cx, cy]) as [number, number];
      const enu = lngLatToMeters(lng, lat, centerLng, centerLat);
      const az = Number(h.azimuth_deg);
      const dip = Number(h.dip_deg);
      const dep = Number(h.depth_m);
      const azRad = (az * Math.PI) / 180;
      const dipRad = (dip * Math.PI) / 180;
      const dx = Math.sin(azRad) * Math.cos(dipRad);
      const dy = Math.cos(azRad) * Math.cos(dipRad);
      const dz = Math.sin(dipRad);
      const collar = { x: enu.x, y: enu.y, z: cz };
      const toe = { x: enu.x + dx * dep, y: enu.y + dy * dep, z: cz + dz * dep };
      const rows = byHole.get(h.id as string) ?? [];
      const intervals = rows
        .map((rr) => {
          const cu = Number(rr.cu_pct ?? 0);
          const au = Number(rr.au_gpt ?? 0);
          const ag = Number(rr.ag_gpt ?? 0);
          const mo = Number(rr.mo_pct ?? 0);
          return {
            from: Number(rr.from_m), to: Number(rr.to_m),
            cuPct: cu, auGpt: au, agGpt: ag, moPct: mo,
            cuEq: cu + au * 0.6 + ag * 0.008 + mo * 4,
            lith: rr.lithology ?? null,
            alt: rr.alteration ?? null,
            mineralized: Boolean(rr.mineralized),
          };
        })
        .sort((a, b) => a.from - b.from);
      return {
        id: h.id as string,
        code: h.hole_code as string,
        collar, toe,
        azimuth: az, dip, depth: dep,
        fromKind: (h.generated_from_kind as string | null) ?? null,
        intervals,
      };
    });

    return { holes: out, count: out.length, source: "synthetic" as const };
  });

// ─── Lector: block model (ENU metros, decimable) ────────────────────────────
export type SyntheticBlock = {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  cuEq: number; conf: number; domain: string;
};
export type BlockModelDataset = {
  blocks: SyntheticBlock[];
  count: number;
  stats: { minCuEq: number; maxCuEq: number; avg: number };
  source: "synthetic" | "empty";
};

export const getSyntheticBlockModel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProjectInput.parse(d))
  .handler(async ({ data }) => {
    const projRes = await supabaseAdmin
      .from("projects").select("center_lng, center_lat").eq("id", data.projectId).maybeSingle();
    if (!projRes.data) return { blocks: [], count: 0, stats: { minCuEq: 0, maxCuEq: 0, avg: 0 }, source: "empty" as const };
    const centerLng = Number(projRes.data.center_lng);
    const centerLat = Number(projRes.data.center_lat);

    const r = await supabaseAdmin
      .from("synthetic_block_model")
      .select("x_utm, y_utm, z_m, size_x, size_y, size_z, cu_eq_pct, confidence, domain")
      .eq("project_id", data.projectId)
      .limit(20000);
    if (r.error || !r.data?.length) return { blocks: [], count: 0, stats: { minCuEq: 0, maxCuEq: 0, avg: 0 }, source: "empty" as const };

    let min = Infinity, max = -Infinity, sum = 0;
    const blocks: SyntheticBlock[] = [];
    for (const b of r.data) {
      const cu = Number(b.cu_eq_pct);
      const [lng, lat] = proj4("EPSG:32719", "EPSG:4326", [Number(b.x_utm), Number(b.y_utm)]) as [number, number];
      const enu = lngLatToMeters(lng, lat, centerLng, centerLat);
      blocks.push({
        x: enu.x, y: enu.y, z: Number(b.z_m),
        sx: Number(b.size_x), sy: Number(b.size_y), sz: Number(b.size_z),
        cuEq: cu, conf: Number(b.confidence), domain: (b.domain as string) ?? "halo",
      });
      if (cu < min) min = cu; if (cu > max) max = cu; sum += cu;
    }
    return {
      blocks, count: blocks.length,
      stats: { minCuEq: min, maxCuEq: max, avg: sum / blocks.length },
      source: "synthetic" as const,
    };
  });

// ─── Lector: pit shells ─────────────────────────────────────────────────────
export type PitShell = {
  id: string;
  rf: number;
  tonnageMt: number;
  gradeAvgCuEq: number;
  stripRatio: number;
  npvUsd: number;
  positions: number[]; // ENU metros (xyz)
  indices: number[];
};
export type PitShellsDataset = {
  shells: PitShell[];
  count: number;
  source: "synthetic" | "empty";
};

export const getPitShells = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProjectInput.parse(d))
  .handler(async ({ data }) => {
    const projRes = await supabaseAdmin
      .from("projects").select("center_lng, center_lat").eq("id", data.projectId).maybeSingle();
    if (!projRes.data) return { shells: [], count: 0, source: "empty" as const };
    const centerLng = Number(projRes.data.center_lng);
    const centerLat = Number(projRes.data.center_lat);

    const r = await supabaseAdmin
      .from("pit_shells")
      .select("id, revenue_factor, tonnage_mt, grade_avg_cu_eq, strip_ratio, npv_usd, mesh_positions, mesh_indices")
      .eq("project_id", data.projectId)
      .order("revenue_factor", { ascending: true });
    if (r.error || !r.data?.length) return { shells: [], count: 0, source: "empty" as const };

    const shells: PitShell[] = r.data.map((s) => {
      const rawPos = s.mesh_positions as number[];
      const enuPos: number[] = new Array(rawPos.length);
      for (let i = 0; i < rawPos.length; i += 3) {
        const [lng, lat] = proj4("EPSG:32719", "EPSG:4326", [rawPos[i], rawPos[i + 1]]) as [number, number];
        const enu = lngLatToMeters(lng, lat, centerLng, centerLat);
        enuPos[i] = enu.x;
        enuPos[i + 1] = enu.y;
        enuPos[i + 2] = rawPos[i + 2];
      }
      return {
        id: s.id as string,
        rf: Number(s.revenue_factor),
        tonnageMt: Number(s.tonnage_mt ?? 0),
        gradeAvgCuEq: Number(s.grade_avg_cu_eq ?? 0),
        stripRatio: Number(s.strip_ratio ?? 0),
        npvUsd: Number(s.npv_usd ?? 0),
        positions: enuPos,
        indices: s.mesh_indices as number[],
      };
    });

    return { shells, count: shells.length, source: "synthetic" as const };
  });
