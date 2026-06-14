// Genera narrativa por sección usando Lovable AI Gateway con structured output.
// Caché en report_section_cache por (project_id, section, data_hash).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getLovableApiKeyOrThrow } from "@/lib/ai-gateway.server";

const Input = z.object({
  projectId: z.string().uuid(),
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  context: z.string().min(1).max(20000),
  dataHash: z.string().min(1).max(64),
  preliminary: z.boolean(),
  force: z.boolean().optional(),
});

const NarrativeSchema = z.object({
  title: z.string(),
  paragraphs: z.array(z.string()).min(1).max(8),
  bullets: z.array(z.string()).max(12).optional(),
  tables: z
    .array(
      z.object({
        caption: z.string().optional(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
    )
    .max(3)
    .optional(),
  warnings: z.array(z.string()).max(5).optional(),
});

export type SectionNarrative = z.infer<typeof NarrativeSchema>;

export const generateSectionNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Cache lookup
    if (!data.force) {
      const { data: cached } = await supabase
        .from("report_section_cache")
        .select("payload")
        .eq("project_id", data.projectId)
        .eq("section", data.sectionId)
        .eq("data_hash", data.dataHash)
        .maybeSingle();
      if (cached?.payload) {
        return { narrative: cached.payload as SectionNarrative, cached: true };
      }
    }

    // AI call
    const apiKey = getLovableApiKeyOrThrow();
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-pro");

    const system = `Eres un geólogo senior chileno especializado en exploración minera Cu-Au-Ag (faja IOCG / pórfido). Escribes secciones técnicas en español profesional para informes pre-NI 43-101 / JORC. Sé conciso, técnico, sin marketing. Si los datos son insuficientes, lo dices claramente y marcas la sección como PRELIMINAR en warnings. No inventes leyes ni tonelajes. Usa unidades SI y notación científica chilena.`;

    const userPrompt = `Sección: ${data.sectionTitle}\n\nContexto del proyecto y datos:\n${data.context}\n\n${data.preliminary ? "AVISO: faltan datos reales — esta sección debe etiquetarse como MODELO PRELIMINAR en warnings." : ""}\n\nGenera la narrativa estructurada (paragraphs, bullets opcionales, tables opcionales, warnings si aplica).`;

    let narrative: SectionNarrative;
    try {
      const result = await generateText({
        model,
        system,
        prompt: userPrompt,
        experimental_output: Output.object({ schema: NarrativeSchema }),
      });
      narrative = result.experimental_output as SectionNarrative;
    } catch (err) {
      console.error("[generateSectionNarrative] AI error", err);
      // Fallback narrative
      narrative = {
        title: data.sectionTitle,
        paragraphs: [
          "No fue posible generar esta sección automáticamente en este momento.",
          "El equipo técnico debe completarla manualmente con los datos del proyecto.",
        ],
        warnings: ["Sección pendiente — IA no disponible"],
      };
    }

    // Persist cache (best-effort)
    await supabase.from("report_section_cache").upsert(
      {
        project_id: data.projectId,
        section: data.sectionId,
        data_hash: data.dataHash,
        payload: narrative as never,
        model: "google/gemini-2.5-pro",
      },
      { onConflict: "project_id,section,data_hash" },
    );

    return { narrative, cached: false };
  });
