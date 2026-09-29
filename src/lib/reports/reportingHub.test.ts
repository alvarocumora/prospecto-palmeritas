import { describe, expect, it } from "vitest";
import { REPORT_PRODUCTS } from "./catalog";
import { STANDARD_FRAMEWORKS, standardCompletion } from "./internationalStandards";

describe("Reporting Hub foundations", () => {
  it("keeps one canonical product per reporting purpose", () => {
    expect(REPORT_PRODUCTS.map((product) => product.id)).toEqual([
      "executive_summary",
      "investment_memorandum",
      "exploration_targeting",
      "technical_evidence",
    ]);
  });

  it("does not imply NI 43-101 compliance without QP review", () => {
    expect(STANDARD_FRAMEWORKS.NI_43_101.positioning).toContain("No debe rotularse");
    expect(STANDARD_FRAMEWORKS.NI_43_101.reviewerRole).toBe("Qualified Person (QP)");
  });

  it("counts only reviewed required checklist items as complete", () => {
    const framework = STANDARD_FRAMEWORKS.NI_43_101;
    const result = standardCompletion(framework, {
      scope: "reviewed",
      property: "reviewed",
      qp: "ready_for_review",
    });
    expect(result.required).toBeGreaterThan(2);
    expect(result.reviewed).toBe(2);
    expect(result.pct).toBeLessThan(100);
  });
});
