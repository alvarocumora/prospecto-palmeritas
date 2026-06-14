// Geo-Copilot de Oportunidades: pregunta en español → filtros JSON → consulta SQL → respuesta narrativa
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Tables } from "@/integrations/supabase/types";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(3).max(500),
});

type Filters = {
  region?: string;
  commodity?: string;
  minScore?: number;
  expiryRisk?: "bajo" | "medio" | "alto";
  maxDistanceKm?: number;
};

async function extractFilters(apiKey: string, question: string): Promise<Filters> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Convierte preguntas en español sobre concesiones mineras en filtros JSON. Devuelve SOLO JSON con campos opcionales: region (string, ej 'Atacama','Antofagasta','Coquimbo','Valparaíso'), commodity (string corto en minúsculas: 'cu','au','ag','li','fe','mo','zn'), minScore (0-100), expiryRisk ('bajo'|'medio'|'alto'), maxDistanceKm (km al yacimiento). Omite los que no apliquen.",
          },
          { role: "user", content: question },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return {};
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return {};
  }
}

async function narrate(
  apiKey: string,
  question: string,
  filters: Filters,
  rows: Tables<"cadastre_opportunities">[],
): Promise<string> {
  try {
    const top = rows.slice(0, 8).map((r) => ({
      nombre: r.holder_name ?? "—",
      region: r.region,
      score: r.score,
      commodity: (r.commodity_hint ?? []).join(","),
      dist_km: r.deposit_proximity_km,
      anomalias: r.anomaly_overlap_count,
      tesis: r.ai_thesis,
    }));
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Eres analista de inversión minera. Responde en español, máximo 5 frases, mencionando 2-3 oportunidades concretas del listado por nombre/región y la acción sugerida. No inventes datos: solo usa lo que recibes.",
          },
          {
            role: "user",
            content: JSON.stringify({ pregunta: question, filtros: filters, resultados: top }),
          },
        ],
      }),
    });
    if (!res.ok)
      return "No pude generar narrativa, pero los resultados están listados a continuación.";
    const json = await res.json();
    return String(json.choices?.[0]?.message?.content ?? "").slice(0, 1500);
  } catch {
    return "Resultados listados a continuación.";
  }
}

export const askOpportunityCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurado");

    const filters = await extractFilters(apiKey, data.question);

    let q = context.supabase
      .from("cadastre_opportunities")
      .select("*")
      .order("score", { ascending: false })
      .limit(20);

    if (filters.minScore != null) q = q.gte("score", filters.minScore);
    else q = q.gte("score", 40);
    if (filters.region) q = q.eq("region", filters.region);
    if (filters.commodity) q = q.contains("commodity_hint", [filters.commodity]);
    if (filters.expiryRisk) q = q.eq("expiry_risk", filters.expiryRisk);
    if (filters.maxDistanceKm) q = q.lte("deposit_proximity_km", filters.maxDistanceKm);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const narrative = await narrate(apiKey, data.question, filters, rows ?? []);

    return {
      question: data.question,
      filters,
      narrative,
      results: rows ?? [],
    };
  });
