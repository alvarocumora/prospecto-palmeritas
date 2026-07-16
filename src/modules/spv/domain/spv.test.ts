import { describe, expect, it } from "vitest";
import { TERRA_AURUM_GOLD_SPV } from "../demo/terraAurum";
import { hasSpvCapability } from "./permissions";
import { canTransitionSpv, transitionSpvStatus } from "./state";

describe("SPV Mining Deals domain", () => {
  it("keeps Terra Aurum cap table at 100 percent", () => {
    const total = TERRA_AURUM_GOLD_SPV.participants.reduce(
      (sum, participant) => sum + participant.ownershipPct,
      0,
    );
    expect(total).toBe(100);
  });

  it("keeps all GeoCapitals compensation disclosed", () => {
    expect(TERRA_AURUM_GOLD_SPV.compensationRules.every((rule) => rule.disclosed)).toBe(true);
  });

  it("allows valid lifecycle transitions and blocks invalid jumps", () => {
    expect(canTransitionSpv("draft", "structuring")).toBe(true);
    expect(canTransitionSpv("draft", "funded")).toBe(false);
    expect(transitionSpvStatus("structuring", "start_due_diligence")).toBe("due_diligence");
  });

  it("grants read-only audit access without management permissions", () => {
    expect(hasSpvCapability("auditor", "spv.view")).toBe(true);
    expect(hasSpvCapability("auditor", "audit.view")).toBe(true);
    expect(hasSpvCapability("auditor", "spv.manage")).toBe(false);
  });
});
