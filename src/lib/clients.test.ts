import { describe, expect, it } from "vitest";
import { aggregateClients, type TradeForClients } from "./clients";

const ME = "me";
const t = (o: Partial<TradeForClients>): TradeForClients => ({
  id: crypto.randomUUID(),
  buyer_user_id: "otro",
  seller_user_id: ME,
  total_value_usd: 0,
  stage: "spa",
  status: "active",
  created_at: "2026-07-01T00:00:00Z",
  ...o,
});

describe("aggregateClients", () => {
  it("agrupa por contraparte y suma valores", () => {
    const out = aggregateClients(
      [
        t({ buyer_user_id: "c1", total_value_usd: 100 }),
        t({ buyer_user_id: "c1", total_value_usd: 50, stage: "closed" }),
        t({ buyer_user_id: "c2", total_value_usd: 10 }),
      ],
      ME,
    );
    expect(out).toHaveLength(2);
    const c1 = out.find((c) => c.userId === "c1")!;
    expect(c1.trades).toBe(2);
    expect(c1.active).toBe(1);
    expect(c1.closed).toBe(1);
    expect(c1.totalUsd).toBe(150);
  });

  it("detecta el sentido del negocio (me compra vs me vende)", () => {
    const out = aggregateClients(
      [
        t({ buyer_user_id: "c1", seller_user_id: ME }),
        t({ buyer_user_id: "c1", seller_user_id: ME }),
        t({ buyer_user_id: ME, seller_user_id: "c2" }),
      ],
      ME,
    );
    expect(out.find((c) => c.userId === "c1")!.mostlyBuysFromMe).toBe(true);
    expect(out.find((c) => c.userId === "c2")!.mostlyBuysFromMe).toBe(false);
  });

  it("ordena por valor total y registra última actividad", () => {
    const out = aggregateClients(
      [
        t({ buyer_user_id: "chico", total_value_usd: 5 }),
        t({ buyer_user_id: "grande", total_value_usd: 500 }),
        t({ buyer_user_id: "grande", total_value_usd: 0, created_at: "2026-07-15T00:00:00Z" }),
      ],
      ME,
    );
    expect(out[0].userId).toBe("grande");
    expect(out[0].lastActivity).toBe("2026-07-15T00:00:00Z");
  });

  it("ignora trades donde no soy parte o la contraparte soy yo", () => {
    const out = aggregateClients([t({ buyer_user_id: ME, seller_user_id: ME })], ME);
    expect(out).toHaveLength(0);
  });

  it("trades cancelados no cuentan como activos pero sí como historial", () => {
    const out = aggregateClients([t({ buyer_user_id: "c1", status: "cancelled" })], ME);
    expect(out[0].trades).toBe(1);
    expect(out[0].active).toBe(0);
  });
});
