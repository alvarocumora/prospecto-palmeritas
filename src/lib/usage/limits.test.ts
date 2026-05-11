import { describe, expect, it } from "vitest";
import { canConsumeUsage, evaluateAllUsageLimits, evaluateUsageLimit, getUsageLimit } from "./limits";

describe("usage limit evaluator", () => {
  it("returns plan defaults", () => {
    expect(getUsageLimit("projects_per_org", { plan: "starter", usage: {} })).toEqual({
      limit: 5,
      source: "plan",
    });
  });

  it("supports explicit overrides", () => {
    expect(
      getUsageLimit("projects_per_org", {
        plan: "starter",
        usage: {},
        overrides: { projects_per_org: 12 },
      })
    ).toEqual({ limit: 12, source: "override" });
  });

  it("evaluates remaining usage and allowed state", () => {
    expect(
      evaluateUsageLimit("ai_briefs_per_month", {
        plan: "pro",
        usage: { ai_briefs_per_month: 25 },
      })
    ).toEqual({
      key: "ai_briefs_per_month",
      used: 25,
      limit: 100,
      remaining: 75,
      allowed: true,
      source: "plan",
    });
  });

  it("blocks usage when the limit is reached", () => {
    expect(
      evaluateUsageLimit("ni43101_exports_per_month", {
        plan: "starter",
        usage: { ni43101_exports_per_month: 1 },
      }).allowed
    ).toBe(false);
  });

  it("checks if an amount can be consumed", () => {
    const context = {
      plan: "pro" as const,
      usage: { heavy_sync_jobs_per_day: 8 },
    };

    expect(canConsumeUsage("heavy_sync_jobs_per_day", context, 2)).toBe(true);
    expect(canConsumeUsage("heavy_sync_jobs_per_day", context, 3)).toBe(false);
  });

  it("evaluates every limit in a plan", () => {
    expect(evaluateAllUsageLimits({ plan: "free", usage: {} })).toHaveLength(5);
  });

  it("normalizes negative usage to zero", () => {
    expect(
      evaluateUsageLimit("storage_gb", {
        plan: "free",
        usage: { storage_gb: -10 },
      }).used
    ).toBe(0);
  });
});
