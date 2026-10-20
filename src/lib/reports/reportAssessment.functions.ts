// Estimación, prioridades, resúmenes (técnico e inversionista) y plan de trabajo
// por IA para el informe técnico global. La IA solo interpreta el resumen del
// modelo documental construido con datos reales; no inventa leyes, tonelajes,
// recursos ni valores.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectName: z.string().min(1).max(200),
  standard: z.string().max(40).optional(),
  digest: z.string().min(2).max(40000),
});

// Esquema estricto (todas las claves requeridas, sin límites) — se recorta en código.
export const ReportAssessmentSchema = z.object({
  prospectivity: z.enum(["Alta", "Media", "Baja", "Indeterminada"]),
  confidence: z.enum(["Alta", "Moderada", "Baja", "Insuficiente"]),
  technicalSummary: z.array(z.string()),
  investorSummary: z.array(z.string()),
  synthesis: z.array(z.string()),
  priorities: z.array(
    z.object({
      level: z.enum(["P1", "P2", "P3"]),
      target: z.string(),
      rationale: z.string(),
      evidence: z.string(),
      action: z.string(),
    }),
  ),
  workPlan: z.array(
    z.object({
      phase: z.string(),
      activities: z.string(),
      duration: z.string(),
      deliverable: z.string(),
      decisionGate: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
  nextSteps: z.array(z.string()),
});
export type ReportAssessment = z.infer<typeof ReportAssessmentSchema>;

const SYSTEM = `Eres un consultor geológico senior independiente (estilo SRK/AMC) que revisa un informe técnico preliminar de un proyecto minero chileno.
Reglas:
- Interpreta SOLO la evidencia del resumen y respeta su procedencia (OFICIAL, MEDIDO, DECLARADO, MODELADO, INTERPRETADO). Cita cifras solo si aparecen en el resumen, indicando si son declaradas.
- Nunca inventes leyes, tonelajes, recursos, reservas, costos, plazos de producción ni valores económicos. Las firmas satelitales son hipótesis de priorización, no prueba de mineralización.
- Prioridades: P1 = convergencia de evidencia independiente; P2 = evidencia única o no validada en terreno; P3 = contexto regional o marginal. Entre 3 y 8 prioridades, cada una con evidencia concreta.
- technicalSummary: 3–5 párrafos técnicos (geología, evidencia, calidad de datos, riesgos técnicos).
- investorSummary: 3–5 párrafos en lenguaje claro para inversionistas: qué es el proyecto, qué está verificado y qué es declarado, riesgos principales (técnico, legal, liquidez) y qué falta para reducirlos. Sin promesas de rentabilidad.
- workPlan: 3–6 fases secuenciales de verificación con actividades, duración estimada en semanas (orientativa), entregable y criterio de decisión para avanzar.
- synthesis: 2–4 frases ejecutivas. gaps: hasta 8. nextSteps: hasta 6.
- Si la evidencia no alcanza, prospectividad 'Indeterminada' o confianza 'Insuficiente'. Español técnico, sin marketing.`;

export const assessProjectReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { generateStructured } = await import("@/lib/ai-responses.server");
    const r = await generateStructured({
      schema: ReportAssessmentSchema,
      system: SYSTEM,
      prompt: `Proyecto: ${data.projectName}\nMarco de revisión: ${data.standard ?? "NI 43-101"} (solo estructura, no certificación)\n\nRESUMEN DEL INFORME:\n${data.digest}`,
      effort: "medium",
    });
    if (!r.value) return { assessment: null, error: r.error };
    const v = r.value;
    const assessment: ReportAssessment = {
      ...v,
      technicalSummary: v.technicalSummary.slice(0, 5),
      investorSummary: v.investorSummary.slice(0, 5),
      synthesis: v.synthesis.slice(0, 4),
      priorities: v.priorities.slice(0, 8),
      workPlan: v.workPlan.slice(0, 6),
      gaps: v.gaps.slice(0, 8),
      nextSteps: v.nextSteps.slice(0, 6),
    };
    return { assessment, error: null as string | null };
  });
