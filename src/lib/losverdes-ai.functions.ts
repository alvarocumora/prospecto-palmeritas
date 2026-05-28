// Server fns para el visor 3D nivel Datamine de Los Verdes:
//  - getLosVerdesDrillholes(): sondajes 3D derivados de las vetas reales del proyecto,
//    con tramos (assays) sintéticos pero coherentes con strike/dip de cada veta.
//  - explainLosVerdesTarget(): Target Explainer IA (Gemini 2.5 Pro) con salida
//    estructurada y persistencia en ai_anomaly_explanations.
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createLovableAiGatewayProvider,
  getLovableApiKeyOrThrow,
} from "@/lib/ai-gateway.server";

const LOSVERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

// ─────────────────────────────────────────────────────────────────────────────
// Drillholes derivados de las vetas reales del proyecto
// ─────────────────────────────────────────────────────────────────────────────

export type DrillholeAssay = {
  from_m: number;
  to_m: number;
  cu_pct: number;
  au_gpt: number;
  ag_gpt: number;
};

/** Tramo de un sondaje, cada uno extrusionable como columna 3D. */
export type DrillholeSegment = {
  /** Polígono rectangular (footprint) ~ancho 6m de cada tramo, en WGS84. */
  ring: [number, number][];
  /** Base/top en m AMSL (calculado en cliente con el DEM del collar). */
  depth_from_m: number;
  depth_to_m: number;
  /** Color por ley máxima del tramo. */
  color: string;
  /** Tooltip props. */
  assay: DrillholeAssay;
};

export type LosVerdesDrillhole = {
  id: string;
  hole_id: string;
  collar_lng: number;
  collar_lat: number;
  azimuth_deg: number;
  dip_deg: number;
  depth_m: number;
  vein_code: string;
  segments: DrillholeSegment[];
  max_cu_pct: number;
  max_au_gpt: number;
};

// PRNG determinista para que el dataset sea estable.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gradeColor(cu: number, au: number): string {
  const cuScore = Math.min(1, cu / 3); // 3% Cu = max
  const auScore = Math.min(1, au / 5); // 5 g/t Au = max
  const s = Math.max(cuScore, auScore);
  if (s >= 0.75) return "#dc2626"; // bonanza
  if (s >= 0.45) return "#f59e0b"; // ley alta
  if (s >= 0.2) return "#eab308"; // ley media
  if (s >= 0.05) return "#10b981"; // ley baja
  return "#64748b"; // estéril
}

// Convierte un offset metros (E,N) a delta lng/lat en una lat dada.
function metersToDeg(dE: number, dN: number, lat: number): [number, number] {
  const dLat = dN / 111320;
  const dLng = dE / (111320 * Math.cos((lat * Math.PI) / 180));
  return [dLng, dLat];
}

function buildSegmentRing(
  collarLng: number,
  collarLat: number,
  azimuth: number,
  dip: number,
  fromM: number,
  toM: number,
  widthM = 6,
): [number, number][] {
  // proyección horizontal del eje del sondaje
  const dipRad = (dip * Math.PI) / 180;
  const azRad = (azimuth * Math.PI) / 180;
  const cosDip = Math.cos(dipRad);
  const horizFrom = fromM * cosDip;
  const horizTo = toM * cosDip;
  const ex = Math.sin(azRad);
  const ny = Math.cos(azRad);
  // dirección perpendicular para el ancho
  const px = Math.cos(azRad);
  const py = -Math.sin(azRad);
  const hw = widthM / 2;
  const aE = ex * horizFrom + px * hw;
  const aN = ny * horizFrom + py * hw;
  const bE = ex * horizTo + px * hw;
  const bN = ny * horizTo + py * hw;
  const cE = ex * horizTo - px * hw;
  const cN = ny * horizTo - py * hw;
  const dE = ex * horizFrom - px * hw;
  const dN = ny * horizFrom - py * hw;
  const A = metersToDeg(aE, aN, collarLat);
  const B = metersToDeg(bE, bN, collarLat);
  const C = metersToDeg(cE, cN, collarLat);
  const D = metersToDeg(dE, dN, collarLat);
  return [
    [collarLng + A[0], collarLat + A[1]],
    [collarLng + B[0], collarLat + B[1]],
    [collarLng + C[0], collarLat + C[1]],
    [collarLng + D[0], collarLat + D[1]],
    [collarLng + A[0], collarLat + A[1]],
  ];
}

export const getLosVerdesDrillholes = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data: veins, error } = await supabaseAdmin
      .from("veins")
      .select(
        "id, code, name, commodity, strike_deg, dip_deg, dip_dir_deg, geometry, depth_top_m, depth_bottom_m, grade_estimate",
      )
      .eq("project_id", LOSVERDES_PROJECT_ID);
    if (error) throw new Error(error.message);

    const holes: LosVerdesDrillhole[] = [];
    let holeNum = 1;
    for (const v of veins ?? []) {
      type VeinGeom = { type: "LineString"; coordinates: [number, number][] } | null;
      const geom = v.geometry as VeinGeom;
      const coords = geom?.coordinates ?? [];
      if (coords.length < 2) continue;
      const dipDir = Number(v.dip_dir_deg ?? 90);
      const dip = Number(v.dip_deg ?? 75);
      const depthBottom = Number(v.depth_bottom_m ?? 200);
      const ge = (v.grade_estimate as Record<string, number> | null) ?? {};
      const baseCu = Number(ge.cu_pct ?? 1.2);
      const baseAu = Number(ge.au_gpt ?? 0.4);
      const baseAg = Number(ge.ag_gpt ?? 12);

      const rand = mulberry32(
        Array.from(v.code).reduce((a: number, c: string) => a + c.charCodeAt(0), 0),
      );

      // 2 sondajes por veta, distribuidos a 25% y 65% de la traza
      for (const tParam of [0.25, 0.65]) {
        const segIdx = Math.min(
          coords.length - 2,
          Math.floor(tParam * (coords.length - 1)),
        );
        const f = tParam * (coords.length - 1) - segIdx;
        const [lng0, lat0] = coords[segIdx];
        const [lng1, lat1] = coords[segIdx + 1];
        // collar sobre la traza con leve desplazamiento al hangingwall (dip_dir + 180°)
        const traceLng = lng0 + (lng1 - lng0) * f;
        const traceLat = lat0 + (lat1 - lat0) * f;
        const offsetM = 25 + rand() * 15;
        const offsetAz = (dipDir + 180) % 360; // hacia el techo de la veta
        const [dLng, dLat] = metersToDeg(
          Math.sin((offsetAz * Math.PI) / 180) * offsetM,
          Math.cos((offsetAz * Math.PI) / 180) * offsetM,
          traceLat,
        );
        const collarLng = traceLng + dLng;
        const collarLat = traceLat + dLat;
        const azimuth = dipDir; // hacia la veta
        const depth = Math.max(120, Math.min(420, depthBottom * (0.7 + rand() * 0.4)));
        const step = 20;
        const segs: DrillholeSegment[] = [];
        let maxCu = 0;
        let maxAu = 0;
        for (let from = 0; from < depth; from += step) {
          const to = Math.min(depth, from + step);
          // intersecta veta cuando la profundidad ~ 40-65% del sondaje
          const mid = (from + to) / 2;
          const distNorm = Math.abs(mid / depth - 0.5);
          const inOreZone = distNorm < 0.18;
          const noise = (rand() - 0.5) * 0.6;
          const cu = Math.max(
            0,
            inOreZone ? baseCu * (1.2 + rand() * 1.5) + noise : 0.02 + rand() * 0.15,
          );
          const au = Math.max(
            0,
            inOreZone ? baseAu * (1.0 + rand() * 1.8) + noise * 0.2 : 0.01 + rand() * 0.05,
          );
          const ag = Math.max(
            0,
            inOreZone ? baseAg * (1.0 + rand() * 1.5) : 0.5 + rand() * 2,
          );
          const assay: DrillholeAssay = {
            from_m: from,
            to_m: to,
            cu_pct: Number(cu.toFixed(3)),
            au_gpt: Number(au.toFixed(2)),
            ag_gpt: Number(ag.toFixed(1)),
          };
          maxCu = Math.max(maxCu, cu);
          maxAu = Math.max(maxAu, au);
          segs.push({
            ring: buildSegmentRing(collarLng, collarLat, azimuth, dip, from, to),
            depth_from_m: from,
            depth_to_m: to,
            color: gradeColor(cu, au),
            assay,
          });
        }
        const holeId = `LV-${String(holeNum).padStart(3, "0")}`;
        holeNum++;
        holes.push({
          id: `${v.id}-${holeId}`,
          hole_id: holeId,
          collar_lng: collarLng,
          collar_lat: collarLat,
          azimuth_deg: azimuth,
          dip_deg: dip,
          depth_m: Math.round(depth),
          vein_code: v.code,
          segments: segs,
          max_cu_pct: Number(maxCu.toFixed(3)),
          max_au_gpt: Number(maxAu.toFixed(2)),
        });
      }
    }
    return { holes, generatedAt: new Date().toISOString(), source: "computed" as const };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Target Explainer (Gemini 2.5 Pro vía Lovable AI Gateway)
// ─────────────────────────────────────────────────────────────────────────────

const ExplainInput = z.object({
  targetCode: z.string().min(1).max(64),
});

const ExplanationSchema = z.object({
  resumen: z.string().describe("Resumen ejecutivo del target en 2-3 frases."),
  hipotesis_geologica: z
    .string()
    .describe("Modelo geológico probable (epitermal, pórfido, IOCG, etc.)."),
  evidencia_satelital: z
    .string()
    .describe("Qué indica la firma satelital (alteración, índices ASTER/Sentinel)."),
  contexto_estructural: z
    .string()
    .describe("Relación con lineamientos y fallas del distrito."),
  fortalezas: z.array(z.string()).max(5),
  riesgos: z.array(z.string()).max(5),
  proximos_pasos: z
    .array(z.string())
    .max(5)
    .describe("Acciones concretas: muestreo, geofísica, sondaje."),
  confianza_pct: z.number().min(0).max(100),
});

export type TargetExplanation = z.infer<typeof ExplanationSchema>;

export const explainLosVerdesTarget = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExplainInput.parse(input))
  .handler(async ({ data }) => {
    const { data: target, error } = await supabaseAdmin
      .from("exploration_targets")
      .select(
        "id, code, name, target_type, commodity, target_zone, lat, lng, elevation_m, stage, priority, score, confidence_pct, rationale, evidence",
      )
      .eq("project_id", LOSVERDES_PROJECT_ID)
      .eq("code", data.targetCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new Error(`Target ${data.targetCode} no encontrado`);

    // Cache: si ya hay explicación en ai_anomaly_explanations, devolverla.
    const { data: cached } = await supabaseAdmin
      .from("ai_anomaly_explanations")
      .select("id, raw_json, created_at")
      .eq("project_id", LOSVERDES_PROJECT_ID)
      .eq("anomaly_kind", "exploration_target")
      .eq("anomaly_id", target.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.raw_json) {
      const parsed = ExplanationSchema.safeParse(cached.raw_json);
      if (parsed.success) {
        return { explanation: parsed.data, cached: true, generatedAt: cached.created_at };
      }
    }

    const provider = createLovableAiGatewayProvider(getLovableApiKeyOrThrow());
    const model = provider("google/gemini-2.5-pro");

    const ctx = `
Proyecto: Distrito Cuprífero Los Verdes – Tilama (Chile, Región de Coquimbo).
Geología regional: franja metalogénica del Cretácico Inferior, vetas Cu-Au-Ag epitermales y estructuras IOCG.
Target a explicar:
- Código: ${target.code}
- Nombre: ${target.name}
- Tipo: ${target.target_type ?? "n/d"}
- Commodity: ${target.commodity ?? "n/d"}
- Zona: ${target.target_zone ?? "n/d"}
- Coordenadas: ${target.lat}, ${target.lng} (elev ${target.elevation_m ?? "?"} m)
- Etapa: ${target.stage ?? "n/d"} · Prioridad: ${target.priority ?? "n/d"}
- Score: ${target.score ?? "?"} · Confianza previa: ${target.confidence_pct ?? "?"}%
- Racional existente: ${target.rationale ?? "(sin racional previo)"}
- Evidencia: ${JSON.stringify(target.evidence ?? {}).slice(0, 800)}
`.trim();

    const { experimental_output: output } = await generateText({
      model,
      experimental_output: Output.object({ schema: ExplanationSchema }),
      system:
        "Eres un geólogo de exploración senior chileno especializado en distritos Cu-Au del Cretácico. Responde en español técnico pero claro, basado en la evidencia entregada. No inventes datos no presentes.",
      prompt: `Analiza el siguiente target y entrega una explicación estructurada que un comité técnico minero pueda usar para priorizar inversión:\n\n${ctx}`,
    });

    // Persistir
    await supabaseAdmin.from("ai_anomaly_explanations").insert({
      project_id: LOSVERDES_PROJECT_ID,
      anomaly_kind: "exploration_target",
      anomaly_id: target.id,
      model: "google/gemini-2.5-pro",
      summary: output.resumen,
      structural_context: output.contexto_estructural,
      confidence: output.confianza_pct / 100,
      raw_json: output,
    });

    return { explanation: output, cached: false, generatedAt: new Date().toISOString() };
  });
