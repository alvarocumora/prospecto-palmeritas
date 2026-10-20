// Estimación y priorización por IA para el informe técnico global de proyecto.
// Entrada: un resumen compacto del modelo documental ya construido con datos
// reales del proyecto. La IA solo interpreta ese resumen; no inventa leyes,
// tonelajes, recursos ni valores.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getLovableApiKeyOrThrow } from "@/lib/ai-gateway.server";

const Input = z.object({
  projectName: z.string().min(1).max(200),
  standard: z.string().max(40).optional(),
  digest: z.string().min(2).max(20000),
});

export const ReportAssessmentSchema = z.object({
  prospectivity: z.enum(["Alta", "Media", "Baja", "Indeterminada"]),
  confidence: z.enum(["Alta", "Moderada", "Baja", "Insuficiente"]),
  synthesis: z.array(z.string()).min(1).max(5),
  priorities: z
    .array(
      z.object({
        level: z.enum(["P1", "P2", "P3"]),
        target: z.string(),
        rationale: z.string(),
        evidence: z.string(),
        action: z.string(),
      }),
    )
    .max(8),
  gaps: z.array(z.string()).max(8),
  nextSteps: z.array(z.string()).max(6),
});
export type ReportAssessment = z.infer<typeof ReportAssessmentSchema>;

export const assessProjectReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(getLovableApiKeyOrThrow());
    const system =
      "Eres un consultor geológico senior (estilo SRK/AMC) que revisa un informe técnico preliminar. Interpretas SOLO la evidencia entregada y respetas su procedencia (OFICIAL, MEDIDO, DECLARADO, MODELADO, INTERPRETADO). Español técnico, sin marketing. Nunca inventes leyes, tonelajes, recursos, reservas ni valores económicos. Las firmas satelitales son hipótesis de priorización, no prueba de mineralización. Prioridades: P1 = convergencia de evidencia independiente (estructura medida + teledetección + geología/geofísica); P2 = evidencia única o no validada en terreno; P3 = contexto regional o marginal. Si la evidencia no alcanza, prospectividad 'Indeterminada' o confianza 'Insuficiente'. Cada prioridad cita la evidencia concreta del resumen.";
    try {
      const r = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        system,
        prompt: `Proyecto: ${data.projectName}\nMarco de revisión: ${data.standard ?? "NI 43-101"} (solo estructura, no certificación)\nResumen del informe:\n${data.digest}\n\nEntrega prospectividad, confianza, síntesis ejecutiva, matriz de prioridades P1–P3, vacíos de información y próximos pasos de verificación.`,
        experimental_output: Output.object({ schema: ReportAssessmentSchema }),
      });
      return { assessment: r.experimental_output as ReportAssessment, error: null as string | null };
    } catch (err) {
      console.error("[assessProjectReport]", err);
      const msg = String((err as Error)?.message ?? "");
      return {
        assessment: null,
        error: /429/.test(msg)
          ? "Límite de uso de IA alcanzado."
          : /402/.test(msg)
            ? "Sin créditos de IA disponibles."
            : "La IA no respondió.",
      };
    }
  });
