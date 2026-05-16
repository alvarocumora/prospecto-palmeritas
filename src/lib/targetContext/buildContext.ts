import { calculateFusionScore } from "@/lib/fusionScore";
import { summarizeEvidence } from "@/lib/geoCopilot";
import type {
  ExplorationTargetContext,
  ExplorationTargetContextInput,
} from "@/types/targetContext";

export function buildExplorationTargetContext(
  input: ExplorationTargetContextInput,
): ExplorationTargetContext {
  return {
    targetId: input.targetId,
    name: input.name,
    fusionScore: calculateFusionScore(input.inputs),
    evidence: input.evidence,
    evidenceSummary: summarizeEvidence(input.evidence),
  };
}

export function createTargetBriefTitle(
  context: Pick<ExplorationTargetContext, "name" | "fusionScore">,
): string {
  return `${context.name} · Fusion Score ${context.fusionScore.score} · ${context.fusionScore.confidence}`;
}
