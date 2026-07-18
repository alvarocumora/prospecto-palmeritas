import { describe, expect, it } from "vitest";
import { PLAN_ORDER, formatLimitValue, planRank, nextPlanUp, normalizePlanId } from "./plans.meta";

describe("plans.meta", () => {
  it("orden de planes correcto", () => {
    expect(PLAN_ORDER).toEqual(["free", "starter", "pro", "enterprise"]);
  });

  it("planRank y nextPlanUp", () => {
    expect(planRank("free")).toBe(0);
    expect(planRank("enterprise")).toBe(3);
    expect(nextPlanUp("free")).toBe("starter");
    expect(nextPlanUp("pro")).toBe("enterprise");
    expect(nextPlanUp("enterprise")).toBeNull();
  });

  it("formatLimitValue según unidad", () => {
    expect(formatLimitValue(250, "storage_gb")).toBe("250 GB");
    expect(formatLimitValue(10, "ni43101_exports_per_month")).toBe("10/mes");
    expect(formatLimitValue(5, "heavy_sync_jobs_per_day")).toBe("5/día");
    expect(formatLimitValue(25, "projects_per_org")).toBe("25");
  });

  it("normalizePlanId cae a free ante valores desconocidos", () => {
    expect(normalizePlanId("pro")).toBe("pro");
    expect(normalizePlanId("PRO")).toBe("pro");
    expect(normalizePlanId("premium")).toBe("free");
    expect(normalizePlanId(null)).toBe("free");
    expect(normalizePlanId(undefined)).toBe("free");
  });
});
