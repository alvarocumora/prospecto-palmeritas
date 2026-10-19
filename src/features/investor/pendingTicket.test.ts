import { describe, it, expect } from "vitest";
import { ROUND } from "./pendingTicket";

describe("ronda minera", () => {
  it("ticket mínimo es USD 15.000 = 150 acciones", () => {
    expect(ROUND.minTicket).toBe(15_000);
    expect(ROUND.minTicket / ROUND.sharePrice).toBe(150);
  });
});
