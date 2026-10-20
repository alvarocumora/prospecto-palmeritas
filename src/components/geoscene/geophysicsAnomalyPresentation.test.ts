import { describe, expect, it } from "vitest";
import {
  normalizeGeophysicalAnomalies,
  GEOPHYSICS_SEVERITY_COLORS,
  type GeophysicsAnomalyRow,
} from "./geophysicsAnomalyPresentation";

const anomaly = (overrides: Partial<GeophysicsAnomalyRow> = {}): GeophysicsAnomalyRow => ({
  code: "MAG-001",
  lat: -33.6,
  lng: -71.2,
  severity: "high",
  estimated_depth_m: null,
  peak_value: null,
  anomaly_type: "magnetic",
  ...overrides,
});

describe("geophysical anomaly presentation", () => {
  it("never fabricates a depth or peak value for missing measurements", () => {
    expect(normalizeGeophysicalAnomalies([anomaly()])).toEqual([
      {
        code: "MAG-001",
        lat: -33.6,
        lng: -71.2,
        severity: "high",
        estimatedDepthM: null,
        peakValue: null,
        type: "magnetic",
      },
    ]);
  });

  it("preserves supplied positive estimated depth as metadata only", () => {
    const [row] = normalizeGeophysicalAnomalies([
      anomaly({ estimated_depth_m: 215, peak_value: 37 }),
    ]);
    expect(row.estimatedDepthM).toBe(215);
    expect(row.peakValue).toBe(37);
    expect(row).not.toHaveProperty("elevation");
    expect(row).not.toHaveProperty("subsurfaceVolume");
  });

  it("filters missing and invalid coordinates instead of relocating anomalies", () => {
    const markers = normalizeGeophysicalAnomalies([
      anomaly({ lat: null }),
      anomaly({ lng: 181 }),
      anomaly({ lat: -91 }),
      anomaly({ code: "" }),
      anomaly({ lat: Number.NaN }),
      anomaly({ code: "VALID" }),
    ]);
    expect(markers.map((item) => item.code)).toEqual(["VALID"]);
  });

  it("does not turn missing severity into a fabricated medium classification", () => {
    const [row] = normalizeGeophysicalAnomalies([
      anomaly({ severity: null, estimated_depth_m: -10, peak_value: Number.NaN }),
    ]);
    expect(row.severity).toBe("unknown");
    expect(row.estimatedDepthM).toBeNull();
    expect(row.peakValue).toBeNull();
    expect(GEOPHYSICS_SEVERITY_COLORS.unknown).toBeDefined();
  });

  it("normalizes recorded severity and limits labels", () => {
    const [row] = normalizeGeophysicalAnomalies([
      anomaly({ code: "Z".repeat(250), severity: " CRITICAL " }),
    ]);
    expect(row.code).toHaveLength(120);
    expect(row.severity).toBe("critical");
  });
});
