import { describe, expect, it } from "vitest";
import type { GeophysicsStation } from "@/types/geophysics";
import { buildFieldGeophysicsSurface } from "./geophysicsSurface";

function station(
  id: string,
  lat: number,
  lng: number,
  values: Partial<GeophysicsStation>,
): GeophysicsStation {
  return {
    id,
    project_id: "cholqui",
    survey_id: "survey",
    station_id: id,
    lat,
    lng,
    mag_nt: null,
    ip_chargeability_mvv: null,
    ip_resistivity_ohmm: null,
    is_synthetic: false,
    notes: null,
    ...values,
  };
}

describe("field geophysics surface", () => {
  const field = [
    station("a", -33.85, -71.05, { mag_nt: 100, ip_chargeability_mvv: 10 }),
    station("b", -33.85, -71.04, { mag_nt: 110, ip_chargeability_mvv: 20 }),
    station("c", -33.86, -71.05, { mag_nt: 90, ip_chargeability_mvv: 30 }),
    station("d", -33.86, -71.04, { mag_nt: 120, ip_chargeability_mvv: 40 }),
  ];

  it("builds a field-only magnetic residual surface", () => {
    const surface = buildFieldGeophysicsSurface(field, "mag_residual_nt", { gridSize: 8 });

    expect(surface).not.toBeNull();
    expect(surface?.sourceCount).toBe(4);
    expect(surface?.baseline).toBe(105);
    expect(surface?.cells).toHaveLength(64);
    expect(surface?.provenance).toBe("FIELD_INTERPOLATION");
  });

  it("never uses synthetic stations as evidence for a surface", () => {
    const synthetic = field.map((item) => ({ ...item, is_synthetic: true }));

    expect(buildFieldGeophysicsSurface(synthetic, "mag_residual_nt")).toBeNull();
  });

  it("rejects mixed campaigns rather than combining acquisition baselines", () => {
    const mixed = field.map((item, index) => ({
      ...item,
      survey_id: index === 0 ? "other-survey" : item.survey_id,
    }));
    expect(buildFieldGeophysicsSurface(mixed, "mag_residual_nt")).toBeNull();
  });

  it("requires acquisition QA for repeated positions", () => {
    expect(
      buildFieldGeophysicsSurface([...field, { ...field[0], id: "repeat" }], "mag_residual_nt"),
    ).toBeNull();
  });

  it("requires enough field measurements", () => {
    expect(buildFieldGeophysicsSurface(field.slice(0, 3), "ip_chargeability_mvv")).toBeNull();
  });

  it("interpolates IP chargeability without pretending it is an inversion", () => {
    const surface = buildFieldGeophysicsSurface(field, "ip_chargeability_mvv", { gridSize: 8 });

    expect(surface?.unit).toBe("mV/V");
    expect(surface?.min).toBeGreaterThanOrEqual(10);
    expect(surface?.max).toBeLessThanOrEqual(40);
  });
});
