import { describe, expect, it } from "vitest";
import { buildExplorationTargetContext, createTargetBriefTitle } from "./buildContext";

describe("target context builder", () => {
  it("builds target context from fusion score inputs and evidence", () => {
    const context = buildExplorationTargetContext({
      targetId: "target-1",
      name: "Target Norte",
      inputs: {
        geophysics: 90,
        geochemistry: 85,
        structural: 75,
        satellite: 70,
        drilling: 65,
      },
      evidence: [
        {
          id: "e1",
          category: "target",
          label: "Target Norte",
          confidence: "high",
          source: "Fusion Score",
        },
      ],
    });

    expect(context).toEqual({
      targetId: "target-1",
      name: "Target Norte",
      fusionScore: {
        score: 79,
        confidence: "high",
        drivers: [
          "Geophysics (90)",
          "Geochemistry (85)",
          "Structural control (75)",
          "Satellite alteration (70)",
          "Drilling evidence (65)",
        ],
      },
      evidence: [
        {
          id: "e1",
          category: "target",
          label: "Target Norte",
          confidence: "high",
          source: "Fusion Score",
        },
      ],
      evidenceSummary: {
        total: 1,
        categories: ["target"],
        labels: ["Target: Target Norte · high · Fusion Score"],
      },
    });
  });

  it("creates target brief titles", () => {
    const context = buildExplorationTargetContext({
      targetId: "target-1",
      name: "Target Norte",
      inputs: {
        geophysics: 80,
        geochemistry: 60,
        structural: 70,
        satellite: 50,
        drilling: 40,
      },
      evidence: [],
    });

    expect(createTargetBriefTitle(context)).toBe("Target Norte · Fusion Score 63 · medium");
  });
});
