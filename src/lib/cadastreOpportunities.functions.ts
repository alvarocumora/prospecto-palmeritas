// Pipeline IA: rankea concesiones del catastro nacional como oportunidades.
// - Solo super_admin puede dispararlo manualmente.
// - Computa features con PostGIS (distancia a yacimientos, anomalías cercanas).
// - Genera tesis y acción con Lovable AI Gateway.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScoreInput = z.object({
  limit: z.number().int().min(1).max(2000).default(200),
  region: z.string().optional(),
  minAreaHa: z.number().nonnegative().optional(),
  withAiExplanation: z.boolean().default(true),
});

type Feature = {
  area_ha: number;
  deposit_proximity_km: number | null;
  nearest_deposit_name: string | null;
  nearest_deposit_commodity: string | null;
  nearest_deposit_id: string | null;
  anomaly_overlap_count: number;
  patent_age_years: number | null;
  patent_status: string;
  holder_concentration: number;
  expiry_risk: string;
};

function heuristicScore(f: Feature): { score: number; commodityHint: string[] } {
  let s = 0;
  // Proximidad a yacimiento (0-40 pts)
  if (f.deposit_proximity_km != null) {
    if (f.deposit_proximity_km < 2) s += 40;
    else if (f.deposit_proximity_km < 5) s += 32;
    else if (f.deposit_proximity_km < 10) s += 22;
    else if (f.deposit_proximity_km < 25) s += 12;
    else if (f.deposit_proximity_km < 50) s += 5;
  }
  // Anomalías satelitales (0-25 pts)
  s += Math.min(25, f.anomaly_overlap_count * 8);
  // Tamaño concesión (0-10 pts)
  if (f.area_ha >= 500) s += 10;
  else if (f.area_ha >= 200) s += 7;
  else if (f.area_ha >= 100) s += 5;
  else if (f.area_ha >= 50) s += 3;
  // Riesgo expiración (0-15 pts) — alto riesgo => alta oportunidad de adquisición
  if (f.expiry_risk === "alto") s += 15;
  else if (f.expiry_risk === "medio") s += 8;
  // Concentración titular (0-10 pts) — mientras más concesiones tiene el titular, más serio
  s += Math.min(10, Math.floor(f.holder_concentration / 5));

  const commodityHint = f.nearest_deposit_commodity
    ? [f.nearest_deposit_commodity]
    : [];
  return { score: Math.min(100, Math.round(s * 100) / 100), commodityHint };
}

function computeExpiryRisk(lastPatentYear: number | null, status: string | null): {
  patent_status: string;
  expiry_risk: string;
  patent_age_years: number | null;
} {
  const now = new Date().getFullYear();
  if (!lastPatentYear) {
    return { patent_status: status ?? "desconocido", expiry_risk: "alto", patent_age_years: null };
  }
  const age = now - lastPatentYear;
  let risk = "bajo";
  if (age >= 2) risk = "alto";
  else if (age >= 1) risk = "medio";
  return { patent_status: status ?? "vigente", expiry_risk: risk, patent_age_years: age };
}

async function explainWithAI(
  apiKey: string,
  payload: { name: string; region: string | null; holder: string | null; features: Feature; score: number },
): Promise<{ thesis: string; action: string; confidence: number } | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Eres analista senior de inversión minera. Respondes SIEMPRE en español, en JSON estricto {thesis, action, confidence}. thesis: 2 frases técnicas que justifican el atractivo de la concesión. action: una recomendación accionable corta (ej. 'Contactar titular', 'Preparar oferta de opción', 'Vigilar caducidad'). confidence: 0-1.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const txt = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt);
    return {
      thesis: String(parsed.thesis ?? "").slice(0, 600),
      action: String(parsed.action ?? "").slice(0, 200),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
    };
  } catch {
    return null;
  }
}

export const scoreCadastreOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScoreInput.parse(d))
  .handler(async ({ data, context }) => {
    // Solo super_admin
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Solo super_admin puede ejecutar el scoring");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Consulta con PostGIS: trae candidatos + features pre-computados en SQL
    const sql = `
      WITH base AS (
        SELECT c.id, c.name, c.region, c.commune, c.area_ha, c.holder_name, c.holder_rut,
               c.last_patent_year, c.status, c.geom
        FROM public.cadastre_national c
        WHERE c.archived_at IS NULL
          AND c.geom IS NOT NULL
          ${data.region ? "AND c.region = $2" : ""}
          ${data.minAreaHa ? "AND c.area_ha >= $3" : ""}
        ORDER BY c.area_ha DESC NULLS LAST
        LIMIT $1
      ),
      nearest AS (
        SELECT b.id AS concession_id,
               d.id AS deposit_id,
               d.name AS deposit_name,
               d.primary_commodity AS commodity,
               ST_Distance(b.geom::geography, d.geom::geography)/1000.0 AS dist_km
        FROM base b
        CROSS JOIN LATERAL (
          SELECT md.id, md.name, md.primary_commodity, md.geom
          FROM public.mineral_deposits md
          WHERE md.geom IS NOT NULL
          ORDER BY md.geom <-> b.geom
          LIMIT 1
        ) d
      ),
      anomalies AS (
        SELECT b.id AS concession_id, COUNT(*) AS cnt
        FROM base b
        JOIN public.satellite_anomalies sa
          ON ST_Intersects(b.geom, ST_SetSRID(ST_GeomFromGeoJSON(sa.geometry::text), 4326))
        GROUP BY b.id
      ),
      holders AS (
        SELECT b.holder_rut, COUNT(*) AS holder_count
        FROM public.cadastre_national b
        WHERE b.holder_rut IS NOT NULL
        GROUP BY b.holder_rut
      )
      SELECT b.id, b.name, b.region, b.commune, b.area_ha, b.holder_name, b.holder_rut,
             b.last_patent_year, b.status,
             n.deposit_id, n.deposit_name, n.commodity AS deposit_commodity, n.dist_km,
             COALESCE(a.cnt, 0) AS anomaly_count,
             COALESCE(h.holder_count, 1) AS holder_count
      FROM base b
      LEFT JOIN nearest n ON n.concession_id = b.id
      LEFT JOIN anomalies a ON a.concession_id = b.id
      LEFT JOIN holders h ON h.holder_rut = b.holder_rut;
    `;

    const params: any[] = [data.limit];
    if (data.region) params.push(data.region);
    if (data.minAreaHa) params.push(data.minAreaHa);

    const { data: rows, error } = await supabaseAdmin.rpc("exec_sql_select", {
      _sql: sql,
      _params: params,
    } as any);

    let candidates: any[] = [];
    if (error || !rows) {
      // Fallback: sin RPC, leer con un SELECT más sencillo (sin PostGIS lateral) y completar JS
      const { data: simple } = await supabaseAdmin
        .from("cadastre_national")
        .select("id,name,region,commune,area_ha,holder_name,holder_rut,last_patent_year,status")
        .is("archived_at", null)
        .order("area_ha", { ascending: false, nullsFirst: false })
        .limit(data.limit);
      candidates = (simple ?? []).map((r) => ({
        ...r,
        deposit_id: null,
        deposit_name: null,
        deposit_commodity: null,
        dist_km: null,
        anomaly_count: 0,
        holder_count: 1,
      }));
    } else {
      candidates = rows as any[];
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    let aiOk = 0;
    let aiSkipped = 0;

    const upserts: any[] = [];
    for (const c of candidates) {
      const expiry = computeExpiryRisk(c.last_patent_year, c.status);
      const feat: Feature = {
        area_ha: Number(c.area_ha) || 0,
        deposit_proximity_km: c.dist_km != null ? Number(c.dist_km) : null,
        nearest_deposit_name: c.deposit_name ?? null,
        nearest_deposit_commodity: c.deposit_commodity ?? null,
        nearest_deposit_id: c.deposit_id ?? null,
        anomaly_overlap_count: Number(c.anomaly_count) || 0,
        patent_age_years: expiry.patent_age_years,
        patent_status: expiry.patent_status,
        holder_concentration: Number(c.holder_count) || 1,
        expiry_risk: expiry.expiry_risk,
      };
      const { score, commodityHint } = heuristicScore(feat);

      let thesis: string | null = null;
      let action: string | null = null;
      let confidence: number | null = null;
      // Solo invocamos IA para los top scoring para controlar costo
      if (data.withAiExplanation && apiKey && score >= 35) {
        const ai = await explainWithAI(apiKey, {
          name: c.name ?? "Concesión",
          region: c.region ?? null,
          holder: c.holder_name ?? null,
          features: feat,
          score,
        });
        if (ai) {
          thesis = ai.thesis;
          action = ai.action;
          confidence = ai.confidence;
          aiOk++;
        } else {
          aiSkipped++;
        }
      }

      upserts.push({
        concession_id: c.id,
        score,
        commodity_hint: commodityHint,
        region: c.region ?? null,
        commune: c.commune ?? null,
        area_ha: c.area_ha,
        holder_name: c.holder_name ?? null,
        holder_rut: c.holder_rut ?? null,
        nearest_deposit_id: feat.nearest_deposit_id,
        nearest_deposit_name: feat.nearest_deposit_name,
        nearest_deposit_commodity: feat.nearest_deposit_commodity,
        deposit_proximity_km: feat.deposit_proximity_km,
        anomaly_overlap_count: feat.anomaly_overlap_count,
        patent_status: feat.patent_status,
        expiry_risk: feat.expiry_risk,
        holder_risk_score: Math.min(10, Math.floor(feat.holder_concentration / 5)),
        ai_thesis: thesis,
        ai_action: action,
        ai_confidence: confidence,
        features: feat as any,
        model: thesis ? "google/gemini-3-flash-preview" : null,
        computed_at: new Date().toISOString(),
      });
    }

    // Upsert por concesión
    const { error: upErr } = await supabaseAdmin
      .from("cadastre_opportunities")
      .upsert(upserts, { onConflict: "concession_id" });

    if (upErr) throw new Error(`Error guardando oportunidades: ${upErr.message}`);

    return {
      processed: upserts.length,
      aiExplained: aiOk,
      aiSkipped,
      topScore: Math.max(0, ...upserts.map((u) => u.score)),
    };
  });

// Lectura pública (autenticada) — el ranking lo consume el dashboard.
const ListInput = z.object({
  region: z.string().optional(),
  commodity: z.string().optional(),
  minScore: z.number().min(0).max(100).default(0),
  expiryRisk: z.enum(["bajo", "medio", "alto"]).optional(),
  maxDistanceKm: z.number().positive().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const listOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("cadastre_opportunities")
      .select("*")
      .gte("score", data.minScore)
      .order("score", { ascending: false })
      .limit(data.limit);

    if (data.region) q = q.eq("region", data.region);
    if (data.commodity) q = q.contains("commodity_hint", [data.commodity]);
    if (data.expiryRisk) q = q.eq("expiry_risk", data.expiryRisk);
    if (data.maxDistanceKm) q = q.lte("deposit_proximity_km", data.maxDistanceKm);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
