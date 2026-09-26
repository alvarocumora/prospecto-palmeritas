// Geo-Intel Brief (Sprint 5.2): genera un brief geológico contextual de un punto.
// POST { project_id, lat, lng, radius_m? } → { brief, evidence }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R_EARTH = 6371000;
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, lat, lng, radius_m = 1000 } = await req.json();
    if (!project_id || typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "project_id, lat, lng required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authRes = await requireUser(req);
    if ("error" in authRes) return authRes.error;
    const memRes = await requireProjectMember(admin, authRes.userId, project_id);
    if ("error" in memRes) return memRes.error;

    const [proj, holes, targets, samples, permits, conc, litho, alter] = await Promise.all([
      admin
        .from("projects")
        .select("name,code,commodity,country,region,description")
        .eq("id", project_id)
        .maybeSingle(),
      admin
        .from("drill_holes")
        .select("hole_id,easting,northing,actual_depth,status,target_zone,azimuth,dip")
        .eq("project_id", project_id),
      admin
        .from("exploration_targets")
        .select("code,name,target_type,priority,stage,score,lat,lng,rationale")
        .eq("project_id", project_id),
      admin
        .from("drill_core_logs")
        .select("hole_id,depth_from,depth_to,au_gpt,cu_pct,lithology,alteration")
        .eq("project_id", project_id)
        .gte("au_gpt", 0.3)
        .order("au_gpt", { ascending: false })
        .limit(30),
      admin
        .from("hse_permits")
        .select("title,permit_type,status,expires_at,authority")
        .eq("project_id", project_id),
      admin
        .from("mining_concessions")
        .select("code,name,concession_type,status,holder,area_ha")
        .eq("project_id", project_id),
      admin
        .from("lithology_units")
        .select("unit_code,name,rock_type,age")
        .eq("project_id", project_id),
      admin
        .from("alteration_zones")
        .select("zone_code,name,assemblage,intensity")
        .eq("project_id", project_id),
    ]);

    // Filter targets within radius
    const nearbyTargets = (targets.data ?? [])
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({ ...t, dist_m: haversineM(lat, lng, t.lat, t.lng) }))
      .filter((t) => t.dist_m <= radius_m * 3)
      .sort((a, b) => a.dist_m - b.dist_m)
      .slice(0, 8);

    // Holes are in UTM easting/northing — we approximate by passing all and let LLM reason.
    const nearbyHoles = (holes.data ?? []).slice(0, 10);

    const today = new Date();
    const expiringSoon = (permits.data ?? []).filter((p) => {
      if (!p.expires_at) return false;
      const days = (new Date(p.expires_at).getTime() - today.getTime()) / 86400000;
      return days >= 0 && days <= 90;
    });

    const evidence = {
      project: proj.data,
      point: { lat, lng, radius_m },
      nearby_targets: nearbyTargets,
      nearby_holes: nearbyHoles,
      best_intercepts: (samples.data ?? []).slice(0, 10),
      lithology: (litho.data ?? []).slice(0, 6),
      alteration: (alter.data ?? []).slice(0, 6),
      expiring_permits: expiringSoon,
      concessions: (conc.data ?? []).slice(0, 5),
    };

    const contextStr = `
PROYECTO: ${proj.data?.name ?? "?"} [${proj.data?.code ?? "?"}] · ${proj.data?.commodity ?? "?"}
PUNTO: (${lat.toFixed(5)}, ${lng.toFixed(5)}) · radio análisis ${radius_m} m

LITOLOGÍA del proyecto:
${
  (litho.data ?? [])
    .slice(0, 6)
    .map((l) => `  · ${l.unit_code} ${l.name} (${l.rock_type ?? "?"}, ${l.age ?? "?"})`)
    .join("\n") || "  (sin datos)"
}

ALTERACIÓN:
${
  (alter.data ?? [])
    .slice(0, 6)
    .map((a) => `  · ${a.zone_code} ${a.name} [${a.assemblage ?? "?"}, ${a.intensity ?? "?"}]`)
    .join("\n") || "  (sin datos)"
}

TARGETS CERCANOS (${nearbyTargets.length}):
${nearbyTargets.map((t) => `  · ${t.code} ${t.name} [${t.priority}/${t.stage}] score ${t.score ?? "?"} a ${t.dist_m.toFixed(0)} m · ${t.rationale ?? ""}`).join("\n") || "  (ninguno en el área)"}

SONDAJES DEL PROYECTO (${nearbyHoles.length} de ${(holes.data ?? []).length}):
${nearbyHoles.map((h) => `  · ${h.hole_id} ${h.status} ${h.actual_depth ?? "?"}m → ${h.target_zone ?? ""}`).join("\n") || "  (sin sondajes)"}

INTERCEPTS DESTACADOS (Au ≥ 0.3 g/t):
${
  (samples.data ?? [])
    .slice(0, 10)
    .map(
      (l) =>
        `  · ${l.hole_id} ${l.depth_from}-${l.depth_to}m: Au ${l.au_gpt} g/t${l.cu_pct ? ` Cu ${l.cu_pct}%` : ""} · ${l.lithology ?? "?"} / ${l.alteration ?? "?"}`,
    )
    .join("\n") || "  (sin intercepts)"
}

PERMISOS QUE VENCEN ≤90d:
${
  expiringSoon
    .slice(0, 5)
    .map((p) => `  ⚠ ${p.title} (${p.permit_type}) vence ${p.expires_at}`)
    .join("\n") || "  (ninguno)"
}

CONCESIONES:
${
  (conc.data ?? [])
    .slice(0, 5)
    .map((c) => `  · ${c.code} ${c.name} [${c.status}] ${c.area_ha ?? "?"} ha · ${c.holder ?? "?"}`)
    .join("\n") || "  (sin concesiones)"
}
`.trim();

    const systemPrompt = `Eres GeoCopilot, geólogo senior NI 43-101.
Genera un BRIEF GEOLÓGICO PROFESIONAL del punto indicado, en español, técnico y conciso.

ESTRUCTURA OBLIGATORIA (markdown):
## Síntesis ejecutiva
2-3 frases con el veredicto: ¿qué representa este punto, qué prioridad merece?

## Marco geológico local
Litología y alteración dominantes citando códigos del proyecto.

## Evidencia próxima
Targets, sondajes e intercepts más relevantes con distancias y leyes.

## Restricciones operativas
Permisos vencidos/críticos, concesión titular.

## Recomendación
Acción concreta priorizada: ¿perforar?, ¿muestrear?, ¿permisos?, ¿esperar?

REGLAS:
- Cita códigos reales (DDH-xx, TARGET-xx, permit titles).
- Si no hay evidencia, dilo explícito ("sin sondajes en el radio").
- Máximo 350 palabras totales.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Genera el brief geológico para este punto.\n\nCONTEXTO:\n${contextStr}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway", aiResp.status, t);
      if (aiResp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit, reintenta en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiResp.status === 402)
        return new Response(JSON.stringify({ error: "Sin créditos de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const brief = aiJson.choices?.[0]?.message?.content ?? "(sin contenido)";

    return new Response(JSON.stringify({ brief, evidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geo-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
