import { describe, expect, it } from "vitest";
import {
  normalizeInstrument,
  normalizeStatus,
  totalAllocationPct,
  validateUseOfFunds,
  impliedPostMoneyUsd,
  impliedPreMoneyUsd,
  ticketOutcomeUsd,
  isFundraisePublishable,
  type FundraiseData,
} from "./fundraise";

const base: FundraiseData = {
  roundSizeUsd: 500_000,
  minTicketUsd: 25_000,
  instrument: "option_nsr",
  equityOfferedPct: 20,
  horizonYears: 3,
  valuationLowUsd: 2_000_000,
  valuationHighUsd: 4_000_000,
  valuationMethod: "Comparables + NAV",
  financingStructure: "Opción + hitos no reembolsables + NSR + SPV",
  useOfFunds: [
    { label: "Sondaje", pct: 60 },
    { label: "NI 43-101", pct: 25 },
    { label: "G&A", pct: 15 },
  ],
  milestones: [{ when: "M6", what: "Corrida piloto" }],
  scenarios: [{ key: "base", label: "Base", multiple: 3, note: "" }],
  highlights: ["Oro aluvial", "REE en concentrado"],
  notes: null,
  status: "open",
  isPublic: false,
};

describe("normalizadores", () => {
  it("instrumento conocido / desconocido", () => {
    expect(normalizeInstrument("option_nsr")).toBe("option_nsr");
    expect(normalizeInstrument("EQUITY")).toBe("equity");
    expect(normalizeInstrument("cripto")).toBeNull();
    expect(normalizeInstrument(null)).toBeNull();
  });
  it("estado cae a draft ante lo desconocido", () => {
    expect(normalizeStatus("open")).toBe("open");
    expect(normalizeStatus("ABIERTA")).toBe("draft");
    expect(normalizeStatus(undefined)).toBe("draft");
  });
});

describe("uso de fondos", () => {
  it("suma porcentajes", () => {
    expect(totalAllocationPct(base.useOfFunds)).toBe(100);
    expect(totalAllocationPct([])).toBe(0);
  });
  it("válido cuando ≤100 y cada línea en rango", () => {
    expect(validateUseOfFunds(base.useOfFunds)).toEqual({ ok: true, totalPct: 100, error: null });
  });
  it("inválido si supera 100", () => {
    const r = validateUseOfFunds([
      { label: "a", pct: 70 },
      { label: "b", pct: 40 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.totalPct).toBe(110);
  });
  it("inválido si una línea está fuera de [0,100]", () => {
    expect(validateUseOfFunds([{ label: "x", pct: 120 }]).ok).toBe(false);
    expect(validateUseOfFunds([{ label: "x", pct: -5 }]).ok).toBe(false);
  });
});

describe("valorización implícita", () => {
  it("post-money = ronda / (%/100)", () => {
    expect(impliedPostMoneyUsd(500_000, 20)).toBe(2_500_000);
    expect(impliedPostMoneyUsd(500_000, 0)).toBeNull();
    expect(impliedPostMoneyUsd(null, 20)).toBeNull();
  });
  it("pre-money = post − ronda", () => {
    expect(impliedPreMoneyUsd(500_000, 20)).toBe(2_000_000);
  });
});

describe("ticket y publicable", () => {
  it("valor del ticket al horizonte", () => {
    expect(ticketOutcomeUsd(25_000, base.scenarios[0])).toBe(75_000);
  });
  it("publicable requiere monto, ticket e instrumento", () => {
    expect(isFundraisePublishable(base)).toBe(true);
    expect(isFundraisePublishable({ ...base, instrument: null })).toBe(false);
    expect(isFundraisePublishable({ ...base, roundSizeUsd: null })).toBe(false);
  });
});
