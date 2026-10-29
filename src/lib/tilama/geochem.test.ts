import { describe, expect, it } from "vitest";
import { TILAMA_SAMPLES, cuThresholdCounts, multiElementProps, qaFlags, topBy } from "./geochem";

describe("Tilama geoquímica", () => {
  it("carga las 190 muestras del CSV CORE", () => {
    expect(TILAMA_SAMPLES).toHaveLength(190);
  });
  it("TOO-270 (455.700 ppm Cu) queda marcada para re-ensaye", () => {
    const s = TILAMA_SAMPLES.find((x) => x.Muestra === "TOO-270")!;
    expect(s.Cu_ppm).toBe(455700);
    expect(qaFlags(s)[0]).toMatch(/RE-ENSAYE/);
    expect(topBy("Cu_ppm", 1)[0].Muestra).toBe("TOO-270");
  });
  it("muestras >1 % Cu son 45", () => {
    expect(cuThresholdCounts().find((c) => c.threshold === 1)?.count).toBe(45);
  });
  it("enriquece por código sin distinguir mayúsculas", () => {
    expect(multiElementProps("too-270")?.mo_ppm).toBe(486);
    expect(multiElementProps("XX-1")).toBeNull();
  });
});
