import type { ExplorationTargetContext } from "@/types/targetContext";
import { buildTargetBriefMarkdown } from "./briefMarkdown";

export type TargetPromptOptions = {
  language?: "es" | "en";
  includeRecommendedActions?: boolean;
};

export function buildTargetAnalysisPrompt(
  context: ExplorationTargetContext,
  options: TargetPromptOptions = {}
): string {
  const language = options.language ?? "es";
  const includeRecommendedActions = options.includeRecommendedActions ?? true;
  const brief = buildTargetBriefMarkdown(context);

  const instruction = language === "en"
    ? "Analyze the exploration target using only the traceable evidence provided. Do not invent assays, intercepts, permits, or geological facts."
    : "Analiza el target de exploración usando únicamente la evidencia trazable entregada. No inventes leyes, interceptos, permisos ni hechos geológicos.";

  const output = language === "en"
    ? [
        "Return:",
        "1. Executive interpretation.",
        "2. Geological rationale.",
        "3. Main risks and uncertainties.",
        includeRecommendedActions ? "4. Recommended next actions." : null,
        "5. Evidence cited by category.",
      ].filter(Boolean).join("\n")
    : [
        "Devuelve:",
        "1. Interpretación ejecutiva.",
        "2. Racional geológico.",
        "3. Riesgos e incertidumbres principales.",
        includeRecommendedActions ? "4. Próximas acciones recomendadas." : null,
        "5. Evidencia citada por categoría.",
      ].filter(Boolean).join("\n");

  return [instruction, "", output, "", "## Target context", "", brief].join("\n");
}
