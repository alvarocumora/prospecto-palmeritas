import { describe, expect, it } from "vitest";
import { partnerHubSummary, type HubTrade } from "./partnerHub";
import type { CommissionLike } from "@/lib/commissions";

const t = (over: Partial<HubTrade>): HubTrade => ({
  id: over.id ?? "t",
  reference: "GC-1",
  commodity: "Cu",
  quantity_t: 100,
  total_value_usd: over.total_value_usd ?? 1000,
  stage: over.stage ?? "icpo",
  status: over.status ?? "active",
  role: "seller",
  created_at: "2026-07-01",
});

describe("partnerHubSummary", () => {
  it("cuenta trades y valor; pipeline excluye cerrados y cancelados", () => {
    const trades = [
      t({ id: "a", stage: "icpo", status: "active", total_value_usd: 1000 }),
      t({ id: "b", stage: "shipping", status: "active", total_value_usd: 3000 }),
      t({ id: "c", stage: "closed", status: "closed", total_value_usd: 9000 }),
      t({ id: "d", status: "cancelled", total_value_usd: 5000 }),
    ];
    const commissions: CommissionLike[] = [
      { status: "por_cobrar", commission_usd: 200, commission_pct: null, deal_value_usd: null },
      { status: "liquidada", commission_usd: 100, commission_pct: null, deal_value_usd: null },
      { status: "cancelada", commission_usd: 999, commission_pct: null, deal_value_usd: null },
    ];
    const s = partnerHubSummary(trades, commissions);
    expect(s.tradeCount).toBe(4);
    expect(s.activeCount).toBe(2);
    expect(s.closedCount).toBe(1);
    expect(s.totalDealUsd).toBe(13000); // excluye el cancelado (5000)
    expect(s.pipelineUsd).toBe(4000); // solo activos
    expect(s.commissionsAccruedUsd).toBe(300); // excluye la cancelada
    expect(s.commissionsOutstandingUsd).toBe(200); // solo por_cobrar
  });

  it("hub vacío", () => {
    const s = partnerHubSummary([], []);
    expect(s).toEqual({
      tradeCount: 0,
      activeCount: 0,
      closedCount: 0,
      totalDealUsd: 0,
      pipelineUsd: 0,
      commissionsAccruedUsd: 0,
      commissionsOutstandingUsd: 0,
    });
  });
});
