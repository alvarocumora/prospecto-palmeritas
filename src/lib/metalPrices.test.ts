import { describe, expect, it } from "vitest";
import {
  usdLbToUsdT,
  buildMetalPrices,
  parseMindicador,
  readIndicator,
  LB_PER_TONNE,
} from "./metalPrices";

describe("usdLbToUsdT", () => {
  it("convierte USD/lb a USD/tonelada métrica", () => {
    expect(usdLbToUsdT(1)).toBeCloseTo(LB_PER_TONNE, 4);
    // 6.03 USD/lb ≈ 13.294 USD/t
    expect(usdLbToUsdT(6.03)).toBeCloseTo(13293.87, 0);
  });
});

describe("buildMetalPrices", () => {
  it("deriva USD/t y CLP/lb con dólar", () => {
    const p = buildMetalPrices(6.03, 921.74, "2026-07-06T04:00:00.000Z");
    expect(p.cobreUsdLb).toBe(6.03);
    expect(p.cobreUsdT).toBeCloseTo(13293.87, 0);
    expect(p.cobreClpLb).toBeCloseTo(6.03 * 921.74, 2);
    expect(p.stale).toBe(false);
  });

  it("deja CLP/lb en null si no hay dólar", () => {
    const p = buildMetalPrices(6.03, null, null);
    expect(p.cobreClpLb).toBeNull();
    expect(p.dolarClp).toBeNull();
  });

  it("respeta el flag stale y source de fallback", () => {
    const p = buildMetalPrices(4.17, null, null, { source: "ref", stale: true });
    expect(p.stale).toBe(true);
    expect(p.source).toBe("ref");
  });
});

describe("readIndicator / parseMindicador", () => {
  const sample = {
    libra_cobre: { valor: 6.03, unidad_medida: "Dólar", fecha: "2026-07-06T04:00:00.000Z" },
    dolar: { valor: 921.74, unidad_medida: "Pesos", fecha: "2026-07-06T04:00:00.000Z" },
  };

  it("lee un indicador válido", () => {
    expect(readIndicator(sample, "libra_cobre")).toEqual({
      valor: 6.03,
      fecha: "2026-07-06T04:00:00.000Z",
    });
  });

  it("devuelve null para indicador ausente o inválido", () => {
    expect(readIndicator(sample, "oro")).toBeNull();
    expect(readIndicator({ libra_cobre: { valor: "x" } }, "libra_cobre")).toBeNull();
    expect(readIndicator(null, "libra_cobre")).toBeNull();
  });

  it("parsea la respuesta completa de mindicador", () => {
    const p = parseMindicador(sample);
    expect(p?.cobreUsdLb).toBe(6.03);
    expect(p?.dolarClp).toBe(921.74);
    expect(p?.stale).toBe(false);
  });

  it("devuelve null si falta el cobre", () => {
    expect(parseMindicador({ dolar: { valor: 900, fecha: null } })).toBeNull();
    expect(parseMindicador({})).toBeNull();
  });
});
