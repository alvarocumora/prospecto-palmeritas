import { describe, expect, it } from "vitest";
import { buildFunnel, winRatePct, daysBetween, avgCycleDays, topCommodities } from "./analytics";

describe("buildFunnel", () => {
  it("conversiones etapa-a-etapa y respecto al tope", () => {
    const f = buildFunnel({ requests: 10, proposals: 25, trades: 4, closed: 2 });
    expect(f.map((s) => s.count)).toEqual([10, 25, 4, 2]);
    expect(f[0].convFromPrevPct).toBe(100);
    // trades vs proposals = 4/25 = 16%
    expect(f[2].convFromPrevPct).toBe(16);
    // closed vs top(requests) = 2/10 = 20%
    expect(f[3].convFromTopPct).toBe(20);
  });
  it("tope en cero → conversiones 0 sin dividir por cero", () => {
    const f = buildFunnel({ requests: 0, proposals: 0, trades: 0, closed: 0 });
    expect(f.every((s) => s.convFromTopPct === 0)).toBe(true);
    expect(f[0].convFromPrevPct).toBe(100);
  });
});

describe("winRatePct", () => {
  it("cerradas / operaciones", () => {
    expect(winRatePct(8, 2)).toBe(25);
    expect(winRatePct(0, 0)).toBe(0);
  });
});

describe("daysBetween / avgCycleDays", () => {
  it("días entre fechas, nunca negativo", () => {
    expect(daysBetween("2026-07-01T00:00:00Z", "2026-07-11T00:00:00Z")).toBe(10);
    expect(daysBetween("2026-07-11T00:00:00Z", "2026-07-01T00:00:00Z")).toBe(0);
  });
  it("promedio de ciclo ignora pares sin cierre o inválidos", () => {
    const avg = avgCycleDays([
      { startIso: "2026-07-01T00:00:00Z", endIso: "2026-07-11T00:00:00Z" }, // 10
      { startIso: "2026-07-01T00:00:00Z", endIso: "2026-07-21T00:00:00Z" }, // 20
      { startIso: "2026-07-01T00:00:00Z", endIso: null }, // ignorado
    ]);
    expect(avg).toBe(15);
  });
  it("sin cierres → 0", () => {
    expect(avgCycleDays([{ startIso: "2026-07-01T00:00:00Z", endIso: null }])).toBe(0);
  });
});

describe("topCommodities", () => {
  it("agrupa por commodity y ordena por valor", () => {
    const top = topCommodities([
      { commodity: "cobre", total_value_usd: 100 },
      { commodity: "cobre", total_value_usd: 50 },
      { commodity: "oro", total_value_usd: 500 },
      { commodity: null, total_value_usd: 10 },
    ]);
    expect(top[0]).toEqual({ commodity: "oro", trades: 1, valueUsd: 500 });
    expect(top.find((c) => c.commodity === "cobre")).toEqual({
      commodity: "cobre",
      trades: 2,
      valueUsd: 150,
    });
    expect(top.find((c) => c.commodity === "—")?.trades).toBe(1);
  });
});
