import { describe, expect, it } from "vitest";
import {
  canRequestAdvance,
  validateRequestedAmount,
  nextStatusesFor,
  canTransition,
  isTerminalStatus,
} from "./advanceRequests";

describe("canRequestAdvance", () => {
  it("elegible y condicional pueden solicitar; no elegible no", () => {
    expect(canRequestAdvance("eligible")).toBe(true);
    expect(canRequestAdvance("conditional")).toBe(true);
    expect(canRequestAdvance("ineligible")).toBe(false);
  });
});

describe("validateRequestedAmount", () => {
  it("acepta un monto dentro del tope", () => {
    expect(validateRequestedAmount(5000, 10000).ok).toBe(true);
    expect(validateRequestedAmount(10000, 10000).ok).toBe(true);
  });
  it("tolera 1 USD de redondeo por encima", () => {
    expect(validateRequestedAmount(10001, 10000).ok).toBe(true);
    expect(validateRequestedAmount(10002, 10000).ok).toBe(false);
  });
  it("rechaza monto <= 0 o sin tope", () => {
    expect(validateRequestedAmount(0, 10000).ok).toBe(false);
    expect(validateRequestedAmount(-5, 10000).ok).toBe(false);
    expect(validateRequestedAmount(5000, null).ok).toBe(false);
    expect(validateRequestedAmount(5000, 0).ok).toBe(false);
  });
});

describe("isTerminalStatus", () => {
  it("funded/rejected/cancelled son terminales", () => {
    expect(isTerminalStatus("funded")).toBe(true);
    expect(isTerminalStatus("rejected")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("requested")).toBe(false);
    expect(isTerminalStatus("under_review")).toBe(false);
  });
});

describe("nextStatusesFor / canTransition", () => {
  it("el productor solo puede cancelar mientras no sea terminal", () => {
    expect(nextStatusesFor("requester", "requested")).toEqual(["cancelled"]);
    expect(nextStatusesFor("requester", "approved")).toEqual(["cancelled"]);
    expect(nextStatusesFor("requester", "funded")).toEqual([]);
  });

  it("el financista avanza la revisión por etapas", () => {
    expect(nextStatusesFor("funder", "requested")).toEqual(["under_review", "rejected"]);
    expect(nextStatusesFor("funder", "under_review")).toEqual(["approved", "rejected"]);
    expect(nextStatusesFor("funder", "approved")).toEqual(["funded", "rejected"]);
    expect(nextStatusesFor("funder", "funded")).toEqual([]);
  });

  it("canTransition valida el par rol/estado", () => {
    expect(canTransition("funder", "requested", "under_review")).toBe(true);
    expect(canTransition("funder", "requested", "funded")).toBe(false);
    expect(canTransition("requester", "requested", "cancelled")).toBe(true);
    expect(canTransition("requester", "requested", "approved")).toBe(false);
  });
});
