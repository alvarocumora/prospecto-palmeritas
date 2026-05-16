import { describe, expect, it } from "vitest";
import { buildCapabilitySnapshot, canUseFeature } from "./capabilities";

describe("SaaS capability helpers", () => {
  it("builds feature and usage snapshots for a plan", () => {
    const snapshot = buildCapabilitySnapshot({
      plan: "pro",
      usage: {
        projects_per_org: 10,
        ai_briefs_per_month: 25,
      },
    });

    expect(snapshot.plan).toBe("pro");
    expect(snapshot.enabledFeatures).toContain("geocapital.ai_copilot");
    expect(snapshot.enabledFeatures).toContain("geocapital.advanced_3d");
    expect(snapshot.enabledFeatures).not.toContain("geocapital.investor_crm");
    expect(snapshot.featureDecisions["geocapital.ai_copilot"]).toMatchObject({
      enabled: true,
      source: "plan",
    });
    expect(snapshot.usageDecisions).toHaveLength(5);
  });

  it("applies feature and usage overrides", () => {
    const snapshot = buildCapabilitySnapshot({
      plan: "starter",
      featureOverrides: {
        "geocapital.ai_copilot": { enabled: true, reason: "pilot" },
      },
      usage: { ai_briefs_per_month: 10 },
      usageOverrides: { ai_briefs_per_month: 50 },
    });

    expect(snapshot.featureDecisions["geocapital.ai_copilot"]).toEqual({
      enabled: true,
      source: "override",
      reason: "pilot",
    });
    expect(
      snapshot.usageDecisions.find((decision) => decision.key === "ai_briefs_per_month"),
    ).toMatchObject({
      used: 10,
      limit: 50,
      remaining: 40,
      source: "override",
    });
  });

  it("checks a single feature", () => {
    expect(canUseFeature("geocapital.bulk_sync", { plan: "pro" })).toBe(false);
    expect(canUseFeature("geocapital.bulk_sync", { plan: "enterprise" })).toBe(true);
  });
});
