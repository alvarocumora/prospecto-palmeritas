import { describe, expect, it } from "vitest";
import type { GeoCopilotEvidenceRef } from "@/types/geoCopilot";
import {
  createEvidenceLabel,
  filterEvidenceByConfidence,
  groupEvidenceByCategory,
  summarizeEvidence,
} from "./evidence";

const evidence: GeoCopilotEvidenceRef[] = [
  {
    id: "t1",
    category: "target",
    label: "Target Norte",
    confidence: "high",
    source: "Fusion Score",
  },
  {
    id: "i1",
    category: "intercept",
    label: "DDH-001 24m @ 1.2 g/t Au",
    confidence: "medium",
  },
  {
    id: "t2",
    category: "target",
    label: "Target Sur",
    confidence: "low",
  },
];

describe("GeoCopilot evidence helpers", () => {
  it("groups evidence by category", () => {
    expect(groupEvidenceByCategory(evidence)).toEqual([
      { category: "target", items: [evidence[0], evidence[2]] },
      { category: "intercept", items: [evidence[1]] },
    ]);
  });

  it("creates compact evidence labels", () => {
    expect(createEvidenceLabel(evidence[0])).toBe("Target: Target Norte · high · Fusion Score");
    expect(createEvidenceLabel(evidence[1])).toBe("Intercept: DDH-001 24m @ 1.2 g/t Au · medium");
  });

  it("summarizes evidence", () => {
    expect(summarizeEvidence(evidence)).toEqual({
      total: 3,
      categories: ["target", "intercept"],
      labels: [
        "Target: Target Norte · high · Fusion Score",
        "Intercept: DDH-001 24m @ 1.2 g/t Au · medium",
        "Target: Target Sur · low",
      ],
    });
  });

  it("filters evidence by confidence", () => {
    expect(filterEvidenceByConfidence(evidence, "high")).toEqual([evidence[0]]);
    expect(filterEvidenceByConfidence(evidence, "medium")).toEqual([evidence[1]]);
  });
});
