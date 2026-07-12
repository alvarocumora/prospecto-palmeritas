import { describe, expect, it } from "vitest";
import { scoreReputation, type ReputationSignals } from "./counterpartyReputation";

function sig(over: Partial<ReputationSignals> = {}): ReputationSignals {
  return {
    tradesClosed: 0,
    tradesActive: 0,
    tradesCancelled: 0,
    lotsPublished: 0,
    lotsVerified: 0,
    gmvUsd: 0,
    avgLotTrust: null,
    ...over,
  };
}

describe("scoreReputation", () => {
  it("cuenta nueva sin historial → tier 'new', score neutral", () => {
    const r = scoreReputation(sig());
    expect(r.tier).toBe("new");
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThanOrEqual(60);
  });

  it("muchos cierres + lotes verificados → 'established' y score alto", () => {
    const r = scoreReputation(
      sig({ tradesClosed: 8, lotsPublished: 6, lotsVerified: 5, gmvUsd: 2_000_000 }),
    );
    expect(r.tier).toBe("established");
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("tasa alta de cancelación → tier 'watch' y penalización", () => {
    const r = scoreReputation(sig({ tradesClosed: 1, tradesCancelled: 3 }));
    expect(r.tier).toBe("watch");
    expect(r.factors.some((f) => f.key === "reliability" && f.status === "fail")).toBe(true);
  });

  it("algo de actividad → 'emerging'", () => {
    expect(scoreReputation(sig({ tradesClosed: 1 })).tier).toBe("emerging");
    expect(scoreReputation(sig({ lotsPublished: 2, lotsVerified: 1 })).tier).toBe("emerging");
  });

  it("promedio KYM alto sube el score; bajo lo baja", () => {
    const hi = scoreReputation(sig({ tradesClosed: 2, avgLotTrust: 90 }));
    const lo = scoreReputation(sig({ tradesClosed: 2, avgLotTrust: 20 }));
    expect(hi.score).toBeGreaterThan(lo.score);
    expect(hi.factors.some((f) => f.key === "asset_quality")).toBe(true);
  });

  it("score siempre en 0..100", () => {
    const r = scoreReputation(
      sig({
        tradesClosed: 100,
        lotsPublished: 50,
        lotsVerified: 50,
        gmvUsd: 9e9,
        avgLotTrust: 100,
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("no penaliza fiabilidad con pocas operaciones", () => {
    // 1 cancelada de 2 totales, pero <3 trades → no 'watch'
    const r = scoreReputation(sig({ tradesActive: 1, tradesCancelled: 1 }));
    expect(r.tier).not.toBe("watch");
  });
});
