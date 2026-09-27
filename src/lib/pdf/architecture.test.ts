import { describe, expect, it } from "vitest";
import {
  REPORT_ARCHITECTURES,
  evidenceAllowed,
  sectionNumber,
  validateReportArchitecture,
} from "./architecture";

describe("GeoCapitals Report Architecture v4", () => {
  it("keeps every canonical architecture internally valid", () => {
    for (const architecture of Object.values(REPORT_ARCHITECTURES)) {
      expect(validateReportArchitecture(architecture)).toEqual([]);
    }
  });

  it("requires evidence and confidence immediately after the opening section", () => {
    for (const architecture of Object.values(REPORT_ARCHITECTURES)) {
      expect(architecture.sections[1]?.id).toBe("evidence_confidence");
      expect(sectionNumber(architecture.profile, "evidence_confidence")).toBe("02");
    }
  });

  it("keeps commercial scenarios out of technical evidence", () => {
    expect(evidenceAllowed("technical", "SCENARIO")).toBe(false);
    expect(evidenceAllowed("technical", "PROPOSED")).toBe(false);
    expect(evidenceAllowed("technical", "CERTIFIED")).toBe(true);
    expect(evidenceAllowed("technical", "INTERPRETED")).toBe(true);
  });

  it("forces ground truth before conceptual drilling in targeting", () => {
    const ids = REPORT_ARCHITECTURES.targeting.sections.map((section) => section.id);
    expect(ids.indexOf("ground_truth")).toBeGreaterThan(-1);
    expect(ids.indexOf("proposed_drilling")).toBeGreaterThan(ids.indexOf("ground_truth"));
  });

  it("keeps capital raise out of the technical and targeting narratives", () => {
    const technical = REPORT_ARCHITECTURES.technical.sections.map((section) => section.id);
    const targeting = REPORT_ARCHITECTURES.targeting.sections.map((section) => section.id);
    expect(technical).not.toContain("capital_raise");
    expect(targeting).not.toContain("capital_raise");
  });
});
