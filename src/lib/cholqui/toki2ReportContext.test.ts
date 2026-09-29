import { describe, expect, it } from "vitest";
import { getToki2ReportContext } from "./toki2ReportContext";

describe("Toki 2 report context", () => {
  it("derives the field program from canonical concession geometry", () => {
    const context = getToki2ReportContext();
    expect(context).not.toBeNull();
    expect(context?.areaHa).toBe(100);
    expect(context?.controlPoints).toHaveLength(9);
    expect(context?.controlPoints.at(-1)?.code).toBe("TK2-09");
  });

  it("keeps satellite screening separate from mineral confirmation", () => {
    const context = getToki2ReportContext();
    expect(context?.satelliteAnomaliesInside).toBeGreaterThanOrEqual(0);
    expect(context?.satelliteAnomaliesInside).toBe(0);
  });
});
