import { describe, expect, it } from "vitest";
import { buildTradeBoard, boardSummary, type BoardTrade } from "./tradeBoard";

const mk = (over: Partial<BoardTrade>): BoardTrade => ({
  id: over.id ?? "t",
  reference: over.reference ?? "GC-1",
  commodity: "Cu",
  form: "concentrate",
  quantity_t: 100,
  total_value_usd: over.total_value_usd ?? 1000,
  stage: over.stage ?? "icpo",
  status: over.status ?? "active",
  role: "seller",
  counterparty_name: over.counterparty_name ?? "Comprador X",
  counterparty_company: over.counterparty_company ?? "ACME",
  docs: over.docs ?? [],
});

describe("buildTradeBoard", () => {
  it("agrupa por etapa en orden y suma valor por columna", () => {
    const board = buildTradeBoard([
      mk({ id: "a", stage: "icpo", total_value_usd: 1000 }),
      mk({ id: "b", stage: "icpo", total_value_usd: 500 }),
      mk({ id: "c", stage: "spa", total_value_usd: 2000 }),
    ]);
    // 7 etapas (sin cancelados porque no hay)
    expect(board).toHaveLength(7);
    expect(board[0].key).toBe("icpo");
    expect(board[0].cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(board[0].totalUsd).toBe(1500);
    const spa = board.find((c) => c.key === "spa")!;
    expect(spa.cards).toHaveLength(1);
    expect(spa.totalUsd).toBe(2000);
  });

  it("etapa desconocida cae en intención (icpo)", () => {
    const board = buildTradeBoard([mk({ id: "x", stage: "loquesea" })]);
    expect(board[0].cards.map((c) => c.id)).toEqual(["x"]);
  });

  it("agrega columna Cancelados solo si hay cancelados", () => {
    const board = buildTradeBoard([mk({ id: "z", status: "cancelled" })]);
    expect(board[board.length - 1].key).toBe("cancelled");
    expect(board[board.length - 1].cards).toHaveLength(1);
  });

  it("counterparty legible y docPct calculado", () => {
    const [col] = buildTradeBoard([
      mk({ id: "a", counterparty_name: "Vincent", counterparty_company: "Carpio" }),
    ]);
    expect(col.cards[0].counterparty).toBe("Vincent · Carpio");
    expect(col.cards[0].docPct).toBe(0);
  });
});

describe("boardSummary", () => {
  it("cuenta activos/cerrados/cancelados y pipeline (solo activos)", () => {
    const s = boardSummary([
      mk({ stage: "icpo", status: "active", total_value_usd: 1000 }),
      mk({ stage: "shipping", status: "active", total_value_usd: 3000 }),
      mk({ stage: "closed", status: "closed", total_value_usd: 9000 }),
      mk({ status: "cancelled", total_value_usd: 5000 }),
    ]);
    expect(s.activeCount).toBe(2);
    expect(s.closedCount).toBe(1);
    expect(s.cancelledCount).toBe(1);
    expect(s.pipelineUsd).toBe(4000);
  });
});
