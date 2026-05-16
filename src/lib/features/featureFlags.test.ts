import { describe, expect, it } from "vitest";
import {
  evaluateFeatureFlag,
  isFeatureEnabled,
  isKnownPlan,
  listEnabledFeatures,
} from "./featureFlags";

describe("feature flag evaluator", () => {
  it("detects known plans", () => {
    expect(isKnownPlan("free")).toBe(true);
    expect(isKnownPlan("enterprise")).toBe(true);
    expect(isKnownPlan("unknown")).toBe(false);
  });

  it("enables features by plan", () => {
    expect(isFeatureEnabled("geocapital.marketplace", { plan: "starter" })).toBe(true);
    expect(isFeatureEnabled("geocapital.ai_copilot", { plan: "starter" })).toBe(false);
    expect(isFeatureEnabled("geocapital.bulk_sync", { plan: "enterprise" })).toBe(true);
  });

  it("returns plan-based decisions", () => {
    expect(evaluateFeatureFlag("geocapital.advanced_3d", { plan: "pro" })).toEqual({
      enabled: true,
      source: "plan",
      reason: "Feature enabled for pro plan",
    });

    expect(evaluateFeatureFlag("geocapital.investor_crm", { plan: "pro" })).toEqual({
      enabled: false,
      source: "plan",
      reason: "Feature unavailable for pro plan",
    });
  });

  it("supports explicit enable and disable overrides", () => {
    expect(
      evaluateFeatureFlag("geocapital.ai_copilot", {
        plan: "free",
        overrides: {
          "geocapital.ai_copilot": { enabled: true, reason: "pilot tenant" },
        },
      }),
    ).toEqual({ enabled: true, source: "override", reason: "pilot tenant" });

    expect(
      evaluateFeatureFlag("geocapital.marketplace", {
        plan: "enterprise",
        overrides: {
          "geocapital.marketplace": { enabled: false },
        },
      }),
    ).toEqual({
      enabled: false,
      source: "override",
      reason: "Feature disabled by explicit override",
    });
  });

  it("lists enabled features with overrides applied", () => {
    expect(
      listEnabledFeatures({
        plan: "starter",
        overrides: {
          "geocapital.ai_copilot": { enabled: true },
          "geocapital.marketplace": { enabled: false },
        },
      }),
    ).toEqual(["geocapital.ai_copilot"]);
  });
});
