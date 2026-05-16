// Sprint 5.5 — Interpreta una sección 2D con sondajes proyectados usando Lovable AI.
// Recibe: line (azimut, longitud), holes[] proyectados con intercepts (Au, lito).
// Devuelve: interpretación geológica (continuidad de mineralización, controles estructurales,
// recomendaciones de drilling), en markdown.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SectionPayload {
  line: { lengthM: number; bearingDeg: number; start: [number, number]; end: [number, number] };
  maxOffsetM: number;
  holes: Array<{
    hole_id: string;
    alongM: number;
    signedOffsetM: number;
    azimuth: number | null;
    dip: number | null;
    depth: number | null;
    intercepts: Array<{
      from: number;
      to: number;
      au: number | null;
      cu: number | null;
      lithology: string | null;
      alteration: string | null;
    }>;
  }>;
  projectName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as SectionPayload;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Estadísticas para enriquecer el prompt
    const allInts = body.holes.flatMap((h) => h.intercepts);
    const auInts = allInts.filter((i) => (i.au ?? 0) >= 0.3);
    const maxAu = allInts.reduce((m, i) => Math.max(m, i.au ?? 0), 0);
    const totalMeters = body.holes.reduce((s, h) => s + (h.depth ?? 0), 0);
    const lithos = Array.from(new Set(allInts.map((i) => i.lithology).filter(Boolean)));

    const summary = body.holes
      .map((h) => {
        const ints = h.intercepts
          .filter((i) => (i.au ?? 0) >= 0.1 || i.lithology)
          .slice(0, 8)
          .map(
            (i) =>
              `  · ${i.from}-${i.to}m: ${i.lithology ?? "—"}${i.au != null ? ` Au ${i.au}g/t` : ""}${i.alteration ? ` [${i.alteration}]` : ""}`,
          )
          .join("\n");
        return `${h.hole_id} @ ${h.alongM.toFixed(0)}m a lo largo (offset ${h.signedOffsetM.toFixed(0)}m, az ${h.azimuth ?? "—"}° dip ${h.dip ?? "—"}°, prof ${h.depth ?? "—"}m)\n${ints || "  (sin intercepts cargados)"}`;
      })
      .join("\n\n");

    const prompt = `Eres un geólogo senior interpretando una sección vertical 2D de un proyecto de exploración${body.projectName ? ` (${body.projectName})` : ""}.

GEOMETRÍA DE LA SECCIÓN:
- Línea A-A': ${body.line.lengthM.toFixed(0)} m de longitud, azimut ${body.line.bearingDeg.toFixed(0)}°
- Tolerancia de proyección: ±${body.maxOffsetM} m
- ${body.holes.length} sondajes proyectados, ${totalMeters.toFixed(0)}m totales perforados
- ${allInts.length} intervalos logueados, ${auInts.length} con Au ≥ 0.3 g/t (máximo Au: ${maxAu.toFixed(2)} g/t)
- Litologías: ${lithos.join(", ") || "no especificadas"}

DATOS POR SONDAJE:
${summary}

INSTRUCCIONES:
Genera una interpretación geológica concisa (300-450 palabras) en español, en formato markdown. Incluye:

## 1. Síntesis estructural
Continuidad lateral y vertical de las unidades. ¿Hay buzamiento dominante? ¿Veta tabular, stockwork, brechoide?

## 2. Modelo de mineralización
Distribución del Au. ¿Zoneamiento? ¿Mineralización supergena vs hipógena? ¿Controles litológicos o estructurales?

## 3. Continuidad entre sondajes
¿Los intercepts altos son correlacionables hole-a-hole? ¿Hay gaps o desplazamientos sospechosos de fallas?

## 4. Recomendaciones de drilling
2-3 acciones concretas: nuevo collar (con azimut y dip sugeridos), profundización de un hole existente, o sondaje de relleno (infill).

## 5. Riesgos / incertidumbres
Qué falta para confirmar el modelo (assays pendientes, geofísica complementaria, mapeo de superficie).

Sé específico con números (metros, leyes, ángulos). Si la sección no tiene intercepts mineralizados, dilo explícitamente y enfoca la interpretación en la litología y en qué se requiere para encontrar el blanco.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres un geólogo de exploración senior, especialista en sistemas epitermales y orogénicos de Au-Cu. Escribes interpretaciones técnicas claras, accionables y honestas sobre incertidumbres.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Intenta en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos en Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiRes.text();
      throw new Error(`AI gateway ${aiRes.status}: ${txt}`);
    }

    const data = await aiRes.json();
    const interpretation: string =
      data.choices?.[0]?.message?.content ?? "Sin respuesta del modelo.";

    return new Response(
      JSON.stringify({
        interpretation,
        stats: {
          holes: body.holes.length,
          totalMeters,
          intercepts: allInts.length,
          mineralizedIntercepts: auInts.length,
          maxAu,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("section-interpret error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
