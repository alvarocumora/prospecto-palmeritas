import { describe, expect, it } from "vitest";
import { computeNextActions, type NextActionCommission } from "./nextActions";
import { partnerHubSummary, type HubTrade } from "./partnerHub";

const NOW = new Date("2026-07-20T12:00:00Z");

const trade = (over: Partial<HubTrade>): HubTrade => ({
  id: over.id ?? "t",
  reference: over.reference ?? "GC-1",
  commodity: "Cu",
  quantity_t: 100,
  total_value_usd: over.total_value_usd ?? 1000,
  stage: over.stage ?? "icpo",
  status: over.status ?? "active",
  role: "seller",
  created_at: over.created_at ?? "2026-07-18",
});

describe("computeNextActions", () => {
  it("comisión por cobrar = prioridad alta al frente", () => {
    const commissions: NextActionCommission[] = [
      {
        id: "c1",
        trade_id: "t",
        status: "por_cobrar",
        deal_value_usd: null,
        commission_pct: null,
        commission_usd: 500,
      },
    ];
    const trades = [trade({ id: "t", stage: "spa" })];
    const actions = computeNextActions({
      trades,
      commissions,
      summary: partnerHubSummary(trades, commissions),
      now: NOW,
    });
    expect(actions[0].priority).toBe("alta");
    expect(actions[0].key).toBe("commission-collect-c1");
    expect(actions[0].title).toContain("US$ 500");
  });

  it("trade estancado (>14 días) sube a alta", () => {
    const trades = [trade({ id: "old", stage: "icpo", created_at: "2026-06-01" })];
    const actions = computeNextActions({
      trades,
      commissions: [],
      summary: partnerHubSummary(trades, []),
      now: NOW,
    });
    const a = actions.find((x) => x.key === "trade-advance-old")!;
    expect(a.priority).toBe("alta");
    expect(a.title).toContain("estancado");
  });

  it("trade reciente activo = media con hint de etapa", () => {
    const trades = [trade({ id: "n", stage: "fco", created_at: "2026-07-18" })];
    const actions = computeNextActions({
      trades,
      commissions: [],
      summary: partnerHubSummary(trades, []),
      now: NOW,
    });
    const a = actions.find((x) => x.key === "trade-advance-n")!;
    expect(a.priority).toBe("media");
    expect(a.detail).toContain("SPA");
  });

  it("deal cerrado con comisión pendiente → liquidar", () => {
    const trades = [trade({ id: "z", stage: "closed", status: "closed" })];
    const commissions: NextActionCommission[] = [
      {
        id: "cz",
        trade_id: "z",
        status: "pendiente",
        deal_value_usd: 10000,
        commission_pct: 2,
        commission_usd: null,
      },
    ];
    const actions = computeNextActions({
      trades,
      commissions,
      summary: partnerHubSummary(trades, commissions),
      now: NOW,
    });
    expect(actions.some((a) => a.key === "commission-settle-cz")).toBe(true);
  });

  it("sin trades = iniciar; con trades sin activos = reactivar", () => {
    const empty = computeNextActions({
      trades: [],
      commissions: [],
      summary: partnerHubSummary([], []),
      now: NOW,
    });
    expect(empty.some((a) => a.key === "relationship-start")).toBe(true);

    const closed = [trade({ id: "c", stage: "closed", status: "closed" })];
    const react = computeNextActions({
      trades: closed,
      commissions: [],
      summary: partnerHubSummary(closed, []),
      now: NOW,
    });
    expect(react.some((a) => a.key === "relationship-reactivate")).toBe(true);
  });
});
