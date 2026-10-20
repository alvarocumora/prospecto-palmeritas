import { describe, expect, it } from "vitest";
import { assessmentSection } from "./reportAssessment";

describe("assessmentSection", () => {
  it("orders the priority matrix P1 before P2 before P3", () => {
    const s = assessmentSection({
      prospectivity: "Media",
      confidence: "Baja",
      synthesis: ["x"], technicalSummary: [], investorSummary: [], workPlan: [],
      priorities: [
        { level: "P3", target: "c", rationale: "", evidence: "", action: "" },
        { level: "P1", target: "a", rationale: "", evidence: "", action: "" },
        { level: "P2", target: "b", rationale: "", evidence: "", action: "" },
      ],
      gaps: [],
      nextSteps: [],
    });
    const table = s.blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" ? table.rows.map((r) => r[0]) : []).toEqual(["P1", "P2", "P3"]);
  });
});
