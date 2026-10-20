// Estimación geocientífica por IA para una pertenencia seleccionada en el visor.
// Entrada: resumen determinístico de capas reales (propertyAnalysis.ts). La IA
// solo interpreta ese resumen; no inventa leyes, tonelajes ni recursos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectName: z.string().min(1).max(200),
  summary: z.string().min(2).max(12000),
});

export const EstimateSchema = z.object({
  prospectivity: z.enum(["Alta", "Media", "Baja", "Indeterminada"]),
  confidence: z.enum(["Alta", "Moderada", "Baja", "Insuficiente"]),
  synthesis: z.array(z.string()),
  drivers: z.array(z.string()),
  gaps: z.array(z.string()),
  nextSteps: z.array(z.string()),
});
export type PropertyEstimate = z.infer<typeof EstimateSchema>;

export const estimatePropertyProspectivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { generateStructured } = await import("@/lib/ai-responses.server");
    const r = await generateStructured({
      schema: EstimateSchema,
      system:
        "Eres un geólogo senior chileno. Interpretas solo la evidencia entregada (catastro OFICIAL, firmas satelitales MODELADAS, estructuras MEDIDAS, carta geológica OFICIAL, geofísica y sondajes si existen). Español técnico, sin marketing. Nunca inventes leyes, tonelajes, recursos ni valores. Las firmas satelitales son hipótesis de priorización, no prueba de mineralización. Si falta evidencia, la prospectividad es 'Indeterminada' o la confianza 'Insuficiente'. synthesis 1–5 frases; drivers, gaps y nextSteps hasta 6 cada uno.",
      prompt: `Proyecto: ${data.projectName}\nResumen de evidencia dentro de la pertenencia (JSON):\n${data.summary}`,
      effort: "low",
    });
    if (!r.value) return { estimate: null, error: r.error };
    const v = r.value;
    return {
      estimate: {
        ...v,
        synthesis: v.synthesis.slice(0, 5),
        drivers: v.drivers.slice(0, 6),
        gaps: v.gaps.slice(0, 6),
        nextSteps: v.nextSteps.slice(0, 6),
      } as PropertyEstimate,
      error: null as string | null,
    };
  });
