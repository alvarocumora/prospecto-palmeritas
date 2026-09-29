import { describe, expect, it } from "vitest";
import { evaluateDeliveryGate, parseReportReadiness } from "./governance";

const readiness = parseReportReadiness({
  project_id: "p1",
  geochem: { measured: 2, declared: 0, incomplete: 0, total: 2, ready: true },
  geophysics: { real_stations: 0, synthetic_stations: 3, surveys: 1, ready: false },
  targets: { validated: 1, candidates: 2, total: 3, note: "interpretación" },
  mag_targets: { total: 4, note: "regional" },
  overall: {
    has_real_data: true,
    report_ready: true,
    level: "partial_measured",
    note: "Hay dato medido",
  },
});

const report = {
  id: "r1",
  version: 2,
  status: "review",
  leadQpId: "qp1",
  activeStandards: ["ni43101"],
  complianceScore: 97,
  complianceThreshold: 95,
};

describe("report governance", () => {
  it("normalizes report_readiness without trusting arbitrary JSON", () => {
    expect(readiness.geochem.measured).toBe(2);
    expect(readiness.geophysics.syntheticStations).toBe(3);
    expect(readiness.overall.reportReady).toBe(true);
  });

  it("requires a verified reviewer when standards are active", () => {
    const gate = evaluateDeliveryGate({
      readiness,
      report,
      reviewer: null,
      sections: [],
      versions: [],
    });
    expect(gate.status).toBe("reviewer_required");
  });

  it("distinguishes controlled release readiness from regulatory compliance", () => {
    const gate = evaluateDeliveryGate({
      readiness,
      report,
      reviewer: { id: "qp1", fullName: "QP", isVerified: true },
      sections: [
        {
          status: "signed",
          requiresQpReview: true,
          qpId: "qp1",
          signedAt: "2026-09-29T00:00:00Z",
        },
      ],
      versions: [
        {
          versionNo: 2,
          hashSha256: "abc123",
          generatedAt: "2026-09-29T00:00:00Z",
          watermark: null,
        },
      ],
    });
    expect(gate.status).toBe("controlled_release_candidate");
    expect(gate.detail).toContain("no equivale");
  });
});
