import { describe, expect, it } from "vitest";
import type { ExplorationTargetContext } from "@/types/targetContext";
import { buildTargetBriefMarkdown } from "./briefMarkdown";

const context: ExplorationTargetContext = {
  targetId: "target-1",
  name: "Target Norte",
  fusionScore: {
    score: 79,
    confidence: "high",
    drivers: ["Geophysics (90)", "Geochemistry (85)"],
  },
  evidence: [],
  evidenceSummary: {
    total: 2,
    categories: ["target", "intercept"],
    labels: ["Target: Target Norte · high · Fusion Score", "Intercept: DDH-001 · medium"],
  },
};

describe("buildTargetBriefMarkdown", () => {
  it("builds a traceable markdown brief", () => {
    expect(buildTargetBriefMarkdown(context)).toBe(`# Target Norte · Fusion Score 79 · high

## Resumen ejecutivo

El target **Target Norte** presenta un Fusion Score de **79/100** con confianza **high**.

## Drivers principales

- Geophysics (90)
- Geochemistry (85)

## Evidencia trazable

Total evidencia: **2**
Categorías: **target, intercept**

- Target: Target Norte · high · Fusion Score
- Intercept: DDH-001 · medium
`);
  });

  it("uses fallback lines when drivers or evidence are missing", () => {
    expect(
      buildTargetBriefMarkdown({
        ...context,
        fusionScore: { score: 10, confidence: "low", drivers: [] },
        evidenceSummary: { total: 0, categories: [], labels: [] },
      }),
    ).toContain("- Sin datos disponibles");
  });
});
