import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import { tgrStatus, overlapsWithOwn, type OwnCase } from "./ownCases";
import { lngLatToUtm } from "./datum";

describe("plazo TGR 30 días", () => {
  it("vence 30 días corridos después de la fecha de rol", () => {
    expect(tgrStatus({ filedAt: "2026-11-17", paid: false, decision: "pagar" }, "2026-11-18")).toMatchObject({ deadline: "2026-12-17", left: 29, level: "holgada" });
  });
  it("marca urgente a 5 días o menos", () => {
    expect(tgrStatus({ filedAt: "2026-11-17", paid: false, decision: "pagar" }, "2026-12-13").level).toBe("urgente");
  });
  it("vencida tras el plazo", () => {
    expect(tgrStatus({ filedAt: "2026-11-17", paid: false, decision: "pagar" }, "2026-12-18").level).toBe("vencida");
  });
  it("dejar vencer no alerta de pago", () => {
    expect(tgrStatus({ filedAt: "2026-11-17", paid: false, decision: "dejar_vencer" }, "2026-12-16").level).toBe("dejar_vencer");
  });
});

describe("blindaje de causas propias", () => {
  const sq = (x: number, y: number, d: number) => turf.polygon([[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]]);
  const c = (g: ReturnType<typeof sq>, decision: OwnCase["decision"] = "pagar"): OwnCase =>
    ({ id: "1", name: "MARTINA 13", rit: "V-326-2026", court: null, filedAt: "2026-11-17", ha: 300, decision, paid: false, geometry: g });
  it("detecta traslape", () => {
    expect(overlapsWithOwn(sq(-71.3, -32, 0.01), [c(sq(-71.295, -32, 0.01))])).toHaveLength(1);
  });
  it("ignora causas que se dejan vencer", () => {
    expect(overlapsWithOwn(sq(-71.3, -32, 0.01), [c(sq(-71.295, -32, 0.01), "dejar_vencer")])).toHaveLength(0);
  });
});

describe("PSAD56", () => {
  it("difiere de WGS84 unos cientos de metros en Chile central", () => {
    const w = lngLatToUtm(-71.3, -32, 19, "WGS84"), p = lngLatToUtm(-71.3, -32, 19, "PSAD56");
    const dn = p[1] - w[1];
    expect(dn).toBeGreaterThan(300);
    expect(dn).toBeLessThan(500);
  });
});
