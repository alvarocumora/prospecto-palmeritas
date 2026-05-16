import type { ExplorationTargetContext } from "@/types/targetContext";
import { createTargetBriefTitle } from "./buildContext";

function list(items: string[]): string {
  if (items.length === 0) return "- Sin datos disponibles";
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildTargetBriefMarkdown(context: ExplorationTargetContext): string {
  const title = createTargetBriefTitle(context);
  const drivers = list(context.fusionScore.drivers);
  const evidenceLabels = list(context.evidenceSummary.labels);
  const categories =
    context.evidenceSummary.categories.length > 0
      ? context.evidenceSummary.categories.join(", ")
      : "Sin categorías";

  return [
    `# ${title}`,
    "",
    "## Resumen ejecutivo",
    "",
    `El target **${context.name}** presenta un Fusion Score de **${context.fusionScore.score}/100** con confianza **${context.fusionScore.confidence}**.`,
    "",
    "## Drivers principales",
    "",
    drivers,
    "",
    "## Evidencia trazable",
    "",
    `Total evidencia: **${context.evidenceSummary.total}**`,
    `Categorías: **${categories}**`,
    "",
    evidenceLabels,
    "",
  ].join("\n");
}
