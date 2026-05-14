import { describe, expect, it } from "vitest";
import type { ExplorationTargetContext } from "@/types/targetContext";
import { buildTargetAnalysisPrompt } from "./promptBuilder";

const context: ExplorationTargetContext = {
  targetId: "target-1",
  name: "Target Norte",
  fusionScore: {
    score: 79,
    confidence: "high",
    drivers: ["Geophysics (90)"],
  },
  evidence: [],
  evidenceSummary: {
    total: 1,
    categories: ["target"],
    labels: ["Target: Target Norte · high · Fusion Score"],
  },
};

describe("buildTargetAnalysisPrompt", () => {
  it("builds a default Spanish prompt", () => {
    const prompt = buildTargetAnalysisPrompt(context);

    expect(prompt).toContain("Analiza el target de exploración");
    expect(prompt).toContain("4. Próximas acciones recomendadas.");
    expect(prompt).toContain("# Target Norte · Fusion Score 79 · high");
    expect(prompt).toContain("- Target: Target Norte · high · Fusion Score");
  });

  it("builds an English prompt", () => {
    const prompt = buildTargetAnalysisPrompt(context, { language: "en" });

    expect(prompt).toContain("Analyze the exploration target");
    expect(prompt).toContain("4. Recommended next actions.");
    expect(prompt).toContain("5. Evidence cited by category.");
  });

  it("can omit the recommended section", () => {
    const prompt = buildTargetAnalysisPrompt(context, { includeRecommendedActions: false });

    expect(prompt).not.toContain("Próximas acciones recomendadas");
    expect(prompt).toContain("5. Evidencia citada por categoría.");
  });
});
