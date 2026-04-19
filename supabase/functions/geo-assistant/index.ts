// Geo-AI assistant: streams Lovable AI responses with project-specific context.
// Receives { project_id, messages: [{role, content}] } and streams SSE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build project context (best-effort, no fail)
    let projectContext = "Sin proyecto seleccionado.";
    if (project_id) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const [proj, holes, surveys, samples, conc] = await Promise.all([
        admin.from("projects").select("name,code,commodity,country,region,description").eq("id", project_id).maybeSingle(),
        admin.from("drill_holes").select("hole_id,actual_depth,planned_depth,status,target_zone").eq("project_id", project_id),
        admin.from("geophysics_surveys").select("name,method,status,planned_km,cost_usd").eq("project_id", project_id),
        admin.from("sampling_results").select("au_gpt,cu_pct,ag_gpt").eq("project_id", project_id).limit(500),
        admin.from("mining_concessions").select("code,name,concession_type,area_ha,status").eq("project_id", project_id),
      ]);

      const totalM = (holes.data ?? []).reduce((s: number, h: any) => s + (Number(h.actual_depth) || 0), 0);
      const samplesArr = samples.data ?? [];
      const auVals = samplesArr.map((s: any) => Number(s.au_gpt)).filter((v) => !isNaN(v));
      const auAvg = auVals.length ? (auVals.reduce((a, b) => a + b, 0) / auVals.length).toFixed(2) : "—";
      const auMax = auVals.length ? Math.max(...auVals).toFixed(2) : "—";
      const capEx = (surveys.data ?? []).reduce((s: number, x: any) => s + (Number(x.cost_usd) || 0), 0);

      projectContext = `
PROYECTO: ${proj.data?.name ?? "?"} (${proj.data?.code ?? "?"})
Commodity: ${proj.data?.commodity ?? "?"} | Ubicación: ${proj.data?.region ?? ""} ${proj.data?.country ?? ""}
Descripción: ${proj.data?.description ?? "—"}

SONDAJES: ${(holes.data ?? []).length} holes, ${totalM.toFixed(0)} m perforados.
${(holes.data ?? []).slice(0, 6).map((h: any) => `  · ${h.hole_id} (${h.status}) ${h.actual_depth ?? "?"}/${h.planned_depth ?? "?"}m → ${h.target_zone ?? ""}`).join("\n")}

GEOFÍSICA: ${(surveys.data ?? []).length} surveys. CapEx: USD ${capEx.toLocaleString()}.
${(surveys.data ?? []).slice(0, 5).map((s: any) => `  · ${s.name} [${s.method}, ${s.status}] ${s.planned_km ?? "?"} km`).join("\n")}

MUESTREO: ${samplesArr.length} muestras. Au promedio ${auAvg} g/t, max ${auMax} g/t.

CONCESIONES: ${(conc.data ?? []).length} (${(conc.data ?? []).reduce((s: number, c: any) => s + (Number(c.area_ha) || 0), 0).toFixed(0)} ha total).
      `.trim();
    }

    const systemPrompt = `Eres un asistente geológico experto para exploración minera. Hablas español por defecto.
Tu rol: ayudar al geólogo con interpretación de datos, sugerir próximos targets de perforación, redactar secciones técnicas (NI 43-101 / JORC), explicar resultados de geofísica y muestreo.

CONTEXTO DEL PROYECTO ACTIVO:
${projectContext}

Reglas:
- Sé conciso y técnico. Usa unidades SI y notación geológica estándar.
- Si te piden "dónde perforar", razona en base a leyes, geometría de vetas, anomalías geofísicas y huecos en el muestreo.
- Cita siempre el dato concreto del proyecto que respalda tu recomendación.
- Si no tienes datos suficientes, dilo y sugiere qué levantar primero.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, intenta en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga en Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("geo-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
