/**
 * Agente geólogo/geofísico IA para Cholqui: redacta una nota técnica breve por
 * cada objetivo (anomalía en tenencia y collar propuesto) usando SOLO los datos
 * de entrada. Salida etiquetada como INTERPRETACIÓN IA, nunca como hecho.
 */
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, getLovableApiKeyOrThrow } from "@/lib/ai-gateway.server";

const TargetSchema = z.object({
  label: z.string().max(40),
  kind: z.enum(["anomalia", "collar", "muestra"]),
  concession: z.string().max(80).nullable(),
  facts: z.string().max(600),
});

const InputSchema = z.object({ targets: z.array(TargetSchema).min(1).max(20) });

export type TargetNote = { label: string; note: string };

const NotesSchema = z.object({
  notes: z.array(z.object({ label: z.string(), note: z.string() })),
});

export const generateCholquiTargetNotes = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<{ notes: TargetNote[]; model: string; error?: string }> => {
    const model = "openai/gpt-6-astra";
    try {
      const provider = createLovableAiGatewayProvider(getLovableApiKeyOrThrow());
      const result = streamText({
        model: provider(model),
        providerOptions: { lovable: { reasoningEffort: "low" } },
        system:
          "Eres un geólogo de exploración y geofísico senior (pórfidos/IOCG, Cordillera de la Costa, Chile). " +
          "Redactas notas técnicas en español, 2 a 3 frases por objetivo, máximo 60 palabras. " +
          "Usa SOLO los hechos entregados; no inventes leyes, recursos, reservas, VAN ni TIR. " +
          "Distingue indicio espectral de mineralización y termina con la verificación de terreno recomendada " +
          "(mapeo, canaleta, magnetometría terrestre, IP). Responde SOLO JSON: " +
          '{"notes":[{"label":"...","note":"..."}]} con el mismo label de cada objetivo.',
        prompt: JSON.stringify(data.targets),
      });
      const text = await result.text;
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = NotesSchema.parse(JSON.parse(json));
      const allowed = new Set(data.targets.map((t) => t.label));
      return { notes: parsed.notes.filter((n) => allowed.has(n.label)), model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error del agente IA";
      console.error("[cholqui-target-notes]", msg);
      return { notes: [], model, error: msg };
    }
  });
