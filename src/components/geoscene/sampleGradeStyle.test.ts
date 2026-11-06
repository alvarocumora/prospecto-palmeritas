import { describe, expect, it } from "vitest";
import { gradeColorFor, gradeLegendCounts, gradeValue } from "./sampleGradeStyle";

describe("sampleGradeStyle", () => {
  it("resolves grade value only from finite numbers", () => {
    expect(gradeValue({ cu_pct: 0.8 }, "cu_pct")).toBe(0.8);
    expect(gradeValue({ cu_pct: null }, "cu_pct")).toBeNull();
    expect(gradeValue({}, "cu_pct")).toBeNull();
    expect(gradeValue({ cu_pct: "0.8" as unknown as number }, "cu_pct")).toBeNull();
  });

  it("colors Cu% samples per Alvy's breakpoints", () => {
    expect(gradeColorFor(0.1, "cu_pct")).toEqual([148, 163, 184]); // < 0.2
    expect(gradeColorFor(0.2, "cu_pct")).toEqual([34, 197, 94]); // 0.2–0.5
    expect(gradeColorFor(0.5, "cu_pct")).toEqual([234, 179, 8]); // 0.5–1.0
    expect(gradeColorFor(1.5, "cu_pct")).toEqual([220, 38, 38]); // > 1.0
    expect(gradeColorFor(null, "cu_pct")).toEqual([100, 116, 139]); // sin dato
  });

  it("buckets a feature collection into legend counts, keeping a no-data bucket", () => {
    const features = [
      { properties: { cu_pct: 0.05 } },
      { properties: { cu_pct: 0.3 } },
      { properties: { cu_pct: 0.3 } },
      { properties: { cu_pct: 1.2 } },
      { properties: { cu_pct: null } },
    ];
    const legend = gradeLegendCounts(features, "cu_pct");
    expect(legend.map((l) => l.count)).toEqual([1, 2, 0, 1, 1]);
    expect(legend.at(-1)?.label).toBe("Sin dato");
  });
});
