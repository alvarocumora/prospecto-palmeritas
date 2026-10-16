import { describe, expect, it } from "vitest";
import { cholquiGeoscienceSections } from "@/lib/pdf/adapters/cholquiGeoscience";
import { haversineM } from "./crossValidation";

describe("validación cruzada Cholqui", () => {
  it("haversine ~111 km por grado de latitud", () => {
    expect(Math.round(haversineM(0, 0, 1, 0) / 1000)).toBe(111);
  });
  it("genera tabla con todos los ensayes ubicados", () => {
    const s = cholquiGeoscienceSections()[0];
    const t = s.blocks.find((b) => b.kind === "appendixTable") as { rows: string[][] };
    console.log(JSON.stringify(t.rows));
    expect(t.rows.length).toBeGreaterThan(0);
  });
});
