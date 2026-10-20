// Estimación geocientífica por IA para una pertenencia seleccionada en el visor.
// Entrada: resumen determinístico de capas reales (propertyAnalysis.ts). La IA
// solo interpreta ese resumen; no inventa leyes, tonelajes ni recursos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getLovableApiKeyOrThrow } from "@/lib/ai-gateway.server";

const Input = z.object({
  projectName: z.string().min(1).max(200),
  summary: z.string().min(2).max(12000),
});

export const EstimateSchema = z.object({
  prospectivity: z.enum(["Alta", "Media", "Baja", "Indeterminada"]),
  confidence: z.enum(["Alta", "Moderada", "Baja", "Insuficiente"]),
  synthesis: z.array(z.string()).min(1).max(5),
  drivers: z.array(z.string()).max(6),
  gaps: z.array(z.string()).max(6),
  nextSteps: z.array(z.string()).max(6),
});
export type PropertyEstimate = z.infer<typeof EstimateSchema>;

export const estimatePropertyProspectivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(getLovableApiKeyOrThrow());
    const system =
      "Eres un geólogo senior chileno. Interpretas solo la evidencia entregada (catastro OFICIAL, firmas satelitales MODELADAS, estructuras MEDIDAS, carta geológica OFICIAL, geofísica y sondajes si existen). Español técnico, sin marketing. Nunca inventes leyes, tonelajes, recursos ni valores. Las firmas satelitales son hipótesis de priorización, no prueba de mineralización. Si falta evidencia, la prospectividad es 'Indeterminada' o la confianza 'Insuficiente'.";
    try {
      const r = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        system,
        prompt: `Proyecto: ${data.projectName}\nResumen de evidencia dentro de la pertenencia (JSON):\n${data.summary}\n\nEntrega prospectividad cualitativa, confianza, síntesis, impulsores, vacíos y próximos pasos de verificación.`,
        experimental_output: Output.object({ schema: EstimateSchema }),
      });
      return { estimate: r.experimental_output as PropertyEstimate, error: null as string | null };
    } catch (err) {
      console.error("[estimatePropertyProspectivity]", err);
      const msg = String((err as Error)?.message ?? "");
      return {
        estimate: null,
        error: /429/.test(msg) ? "Límite de uso de IA alcanzado; intenta en unos minutos." : /402/.test(msg) ? "Sin créditos de IA disponibles." : "La IA no respondió; intenta de nuevo.",
      };
    }
  });
