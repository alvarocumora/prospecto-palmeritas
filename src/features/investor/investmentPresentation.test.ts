import { describe, expect, it } from "vitest";
import { roundBreakdown, confirmedPositionSummary } from "./investmentPresentation";
import type { WalletPosition } from "@/lib/wallet.functions";

describe("round placement disclosure", () => {
  it("separates the declared Cholqui 47% placement from system commitments", () => {
    const r = roundBreakdown({
      target: 1_500_000,
      anchor: 705_000,
      committed: 735_000,
      settled: 15_000,
    });
    expect(r.systemCommitted).toBe(30_000);
    expect(r.settledPct).toBe(1);
    expect(r.combinedPct).toBe(49);
  });
  it("separates the declared Tilama 65% placement, not paid capital", () => {
    const r = roundBreakdown({
      target: 1_500_000,
      anchor: 975_000,
      committed: 975_000,
      settled: 0,
    });
    expect(r.systemCommitted).toBe(0);
    expect(r.settledPct).toBe(0);
    expect(r.combinedPct).toBe(65);
  });
  it.each([0, -1, NaN])("never calculates a percentage for invalid target %s", (target) => {
    expect(roundBreakdown({ target, anchor: 0, committed: 0, settled: 0 }).combinedPct).toBeNull();
  });
  it("does not turn inconsistent source amounts into false availability", () => {
    expect(
      roundBreakdown({ target: 100, anchor: 80, committed: 20, settled: 0 }).systemCommitted,
    ).toBeNull();
  });
});
const position = (status: string, currency: string, amount: number): WalletPosition => ({
  id: status + currency,
  status,
  currency,
  amount_paid: amount,
  shares: 150,
  subscribed_on: "2026-10-19",
  document_url: null,
  project: "Cholqui",
  token: "CHLQ",
  slug: "cholqui",
  pctOfSpv: 0.1,
});
describe("confirmed capital", () => {
  it("does not mix pending positions or currencies into confirmed capital", () => {
    const s = confirmedPositionSummary([
      position("active", "USD", 15000),
      position("active", "CLP", 15000000),
      position("pending", "USD", 30000),
    ]);
    expect(s.capital.get("USD")).toBe(15000);
    expect(s.capital.get("CLP")).toBe(15000000);
    expect(s.shares).toBe(300);
    expect(s.positions).toHaveLength(2);
  });
});
