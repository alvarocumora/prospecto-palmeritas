// Geo-AI Copilot v2 (Sprint 5.1): inyecta contexto geológico denso del proyecto activo.
// Recibe { project_id, messages: [{role, content}], focus? } y retorna SSE con la respuesta del modelo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, requireProjectMember } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { project_id, messages, focus } = await req.json();
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

    let projectContext = "Sin proyecto activo seleccionado.";
    if (project_id) {
      const authRes = await requireUser(req);
      if ("error" in authRes) return authRes.error;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const memRes = await requireProjectMember(admin, authRes.userId, project_id);
      if ("error" in memRes) return memRes.error;
      const [
        proj,
        holes,
        surveys,
        _samples,
        conc,
        litho,
        alter,
        miner,
        feats,
        targets,
        permits,
        incidents,
        logs,
        wireframes,
      ] = await Promise.all([
        admin
          .from("projects")
          .select("name,code,commodity,country,region,description,center_lat,center_lng")
          .eq("id", project_id)
          .maybeSingle(),
        admin
          .from("drill_holes")
          .select(
            "hole_id,actual_depth,planned_depth,status,target_zone,azimuth,dip,easting,northing",
          )
          .eq("project_id", project_id),
        admin
          .from("geophysics_surveys")
          .select("name,method,status,planned_km,cost_usd,expected_depth_m")
          .eq("project_id", project_id),
        admin
          .from("drill_core_logs")
          .select("hole_id,depth_from,depth_to,au_gpt,cu_pct,ag_gpt,lithology,alteration")
          .eq("project_id", project_id)
          .gte("au_gpt", 0.3)
          .order("au_gpt", { ascending: false })
          .limit(40),
        admin
          .from("mining_concessions")
          .select("code,name,concession_type,area_ha,status,holder,expires_at")
          .eq("project_id", project_id),
        admin
          .from("lithology_units")
          .select("unit_code,name,age,rock_type")
          .eq("project_id", project_id),
        admin
          .from("alteration_zones")
          .select("zone_code,name,assemblage,intensity")
          .eq("project_id", project_id),
        admin
          .from("mineralogy")
          .select("mineral,paragenetic_stage,abundance")
          .eq("project_id", project_id),
        admin
          .from("geological_features")
          .select("feature_code,name,feature_type,strike,dip,length_m")
          .eq("project_id", project_id),
        admin
          .from("exploration_targets")
          .select("code,name,target_type,priority,stage,score,lat,lng,rationale")
          .eq("project_id", project_id)
          .neq("stage", "closed")
          .order("score", { ascending: false })
          .limit(15),
        admin
          .from("hse_permits")
          .select("title,permit_type,status,expires_at,authority")
          .eq("project_id", project_id),
        admin
          .from("hse_incidents")
          .select("category,severity,status,occurred_at")
          .eq("project_id", project_id)
          .neq("status", "closed")
          .limit(10),
        admin.from("drill_core_logs").select("au_gpt").eq("project_id", project_id),
        admin
          .from("geology_wireframes")
          .select("name,commodity,volume_m3,samples_used,created_at")
          .eq("project_id", project_id)
          .order("created_at", { ascending: false }),
      ]);

      const totalM = (holes.data ?? []).reduce(
        (s: number, h) => s + (Number(h.actual_depth) || 0),
        0,
      );
      const allAu = (logs.data ?? [])
        .map((s) => Number(s.au_gpt))
        .filter((v) => !isNaN(v) && v > 0);
      const auAvg = allAu.length
        ? (allAu.reduce((a, b) => a + b, 0) / allAu.length).toFixed(2)
        : "—";
      const auMax = allAu.length ? Math.max(...allAu).toFixed(2) : "—";
      const auP90 = allAu.length
        ? [...allAu].sort((a, b) => a - b)[Math.floor(allAu.length * 0.9)].toFixed(2)
        : "—";
      const capEx = (surveys.data ?? []).reduce((s: number, x) => s + (Number(x.cost_usd) || 0), 0);

      const today = new Date();
      const expiringSoon = (permits.data ?? []).filter((p) => {
        if (!p.expires_at) return false;
        const days = (new Date(p.expires_at).getTime() - today.getTime()) / 86400000;
        return days >= 0 && days <= 60;
      });

      projectContext = `
═══ PROYECTO ACTIVO ═══
${proj.data?.name ?? "?"} [${proj.data?.code ?? "?"}] · ${proj.data?.commodity ?? "?"}
Ubicación: ${proj.data?.region ?? ""} ${proj.data?.country ?? ""} (${proj.data?.center_lat ?? "?"}, ${proj.data?.center_lng ?? "?"})
${proj.data?.description ?? ""}

═══ MARCO GEOLÓGICO ═══
Litología (${(litho.data ?? []).length} unidades):
${(litho.data ?? [])
  .slice(0, 8)
  .map((l) => `  · ${l.unit_code} ${l.name} (${l.rock_type ?? "?"}, ${l.age ?? "?"})`)
  .join("\n")}

Alteración (${(alter.data ?? []).length} zonas):
${(alter.data ?? [])
  .slice(0, 6)
  .map(
    (a) =>
      `  · ${a.zone_code} ${a.name} [${a.assemblage ?? "?"}, intensidad ${a.intensity ?? "?"}]`,
  )
  .join("\n")}

Mineralogía clave:
${(miner.data ?? [])
  .slice(0, 8)
  .map((m) => `  · ${m.mineral} (${m.paragenetic_stage ?? "?"}, ${m.abundance ?? "?"})`)
  .join("\n")}

Estructuras (${(feats.data ?? []).length}):
${(feats.data ?? [])
  .slice(0, 6)
  .map(
    (f) =>
      `  · ${f.feature_code} ${f.name} ${f.feature_type} ${f.strike ?? ""}/${f.dip ?? ""} ${f.length_m ?? "?"}m`,
  )
  .join("\n")}

═══ SONDAJES (${(holes.data ?? []).length} holes, ${totalM.toFixed(0)} m) ═══
${(holes.data ?? [])
  .slice(0, 10)
  .map(
    (h) =>
      `  · ${h.hole_id} ${h.status} az${h.azimuth ?? "?"}/${h.dip ?? "?"}° ${h.actual_depth ?? "?"}/${h.planned_depth ?? "?"}m → ${h.target_zone ?? ""}`,
  )
  .join("\n")}

═══ INTERCEPTS DESTACADOS (Au ≥ 0.3 g/t, top ${Math.min(40, (logs.data ?? []).length)}) ═══
Au promedio: ${auAvg} g/t · P90: ${auP90} g/t · Max: ${auMax} g/t
${(logs.data ?? [])
  .slice(0, 15)
  .map(
    (l) =>
      `  · ${l.hole_id} ${l.depth_from}-${l.depth_to}m: Au ${l.au_gpt} g/t${l.cu_pct ? ` Cu ${l.cu_pct}%` : ""} · ${l.lithology ?? "?"} / ${l.alteration ?? "?"}`,
  )
  .join("\n")}

═══ GEOFÍSICA ═══
${(surveys.data ?? []).length} surveys · CapEx USD ${capEx.toLocaleString()}
${(surveys.data ?? [])
  .slice(0, 5)
  .map(
    (s) =>
      `  · ${s.name} [${s.method}, ${s.status}] ${s.planned_km ?? "?"} km, prof ${s.expected_depth_m ?? "?"}m`,
  )
  .join("\n")}

═══ TARGETS ACTIVOS (${(targets.data ?? []).length}) ═══
${(targets.data ?? [])
  .slice(0, 10)
  .map(
    (t) =>
      `  · ${t.code} ${t.name} [${t.priority}/${t.stage}] score ${t.score ?? "?"} (${t.lat?.toFixed(4) ?? "?"}, ${t.lng?.toFixed(4) ?? "?"}) ${t.rationale ?? ""}`,
  )
  .join("\n")}

═══ HSE / PERMISOS ═══
${expiringSoon.length} permisos vencen en ≤60 días:
${
  expiringSoon
    .slice(0, 5)
    .map((p) => `  ⚠ ${p.title} (${p.permit_type}) vence ${p.expires_at}`)
    .join("\n") || "  (ninguno crítico)"
}
${(incidents.data ?? []).length} incidentes abiertos.

═══ MODELOS IMPLÍCITOS (wireframes RBF, subsuelo) ═══
${(wireframes.data ?? []).length} modelo(s) calculado(s) desde ensayes reales:
${
  (wireframes.data ?? [])
    .slice(0, 8)
    .map(
      (w) =>
        `  · ${w.name} [${w.commodity ?? "?"}] ${w.volume_m3 ? `${Math.round(Number(w.volume_m3)).toLocaleString()} m³` : "vol ?"} · ${w.samples_used ?? "?"} muestras`,
    )
    .join("\n") || "  (ninguno aún — generar desde Estimación → Wireframe Studio)"
}

═══ CATASTRO ═══
${(conc.data ?? []).length} concesiones, ${(conc.data ?? []).reduce((s: number, c) => s + (Number(c.area_ha) || 0), 0).toFixed(0)} ha total.
${(conc.data ?? [])
  .slice(0, 5)
  .map(
    (c) =>
      `  · ${c.code} ${c.name} [${c.concession_type}/${c.status}] ${c.area_ha ?? "?"} ha · ${c.holder ?? "?"}`,
  )
  .join("\n")}
      `.trim();
    }

    const focusBlock = focus ? `\n\n═══ FOCO DE LA PREGUNTA ═══\n${focus}` : "";

    const systemPrompt = `Eres GeoCopilot, asistente IA experto en exploración minera senior (NI 43-101 / JORC).
Hablas español por defecto. Tono: técnico, directo, citando evidencia concreta.

REGLAS:
- Cita siempre el dato del proyecto que respalda tu afirmación (sondaje, ley, código de target, coordenada).
- Para "¿dónde perforar?": razona con (a) targets de mayor score, (b) intercepts adyacentes, (c) anomalías geofísicas, (d) huecos de muestreo, (e) restricciones HSE/catastro, (f) extensión/cierre de los modelos implícitos (wireframes) existentes.
- Para interpretación: usa litología/alteración/mineralogía del marco geológico inyectado.
- Si falta información, di qué levantar primero (survey IP, sondaje step-out, muestreo de canal).
- Usa unidades SI, notación geológica estándar (Au g/t, Cu %, m, °).
- Responde en máx 6 párrafos, con bullets cuando ayuden.

ANCLAJES DE ESCENA (OBLIGATORIO):
- Cada vez que menciones un target, sondaje o anomalía del contexto, etiqueta la primera aparición usando exactamente estos tokens en línea:
  · [target:CODE]    p.ej. [target:T-007]
  · [hole:HOLE_ID]   p.ej. [hole:DDH-12]
  · [anomaly:CODE]   p.ej. [anomaly:MAG-03]
- Usa SIEMPRE el código exacto que aparece en el contexto. No inventes códigos.
- Estos tokens se renderizan como chips clicables que enfocan la entidad en la escena 3D.

CONTEXTO DEL PROYECTO:
${projectContext}${focusBlock}`;

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Sin créditos de IA. Recarga en Settings → Workspace → Usage." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("geo-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
