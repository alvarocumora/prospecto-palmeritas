import { describe, expect, it } from "vitest";
import {
  SHIPMENT_STATUSES,
  shipmentStatusIndex,
  nextShipmentStatus,
  canAdvanceShipment,
  isShipmentDelayed,
} from "./shipments";

describe("estados de embarque", () => {
  it("la secuencia es preparación → puerto → tránsito → arribado → entregado", () => {
    expect(SHIPMENT_STATUSES).toEqual(["preparing", "at_port", "on_water", "arrived", "delivered"]);
    expect(shipmentStatusIndex("on_water")).toBe(2);
  });

  it("nextShipmentStatus avanza un paso y termina en null", () => {
    expect(nextShipmentStatus("preparing")).toBe("at_port");
    expect(nextShipmentStatus("arrived")).toBe("delivered");
    expect(nextShipmentStatus("delivered")).toBeNull();
  });

  it("canAdvanceShipment solo permite el paso siguiente", () => {
    expect(canAdvanceShipment("preparing", "at_port")).toBe(true);
    expect(canAdvanceShipment("preparing", "on_water")).toBe(false);
    expect(canAdvanceShipment("delivered", "delivered")).toBe(false);
    expect(canAdvanceShipment("on_water", "at_port")).toBe(false);
  });
});

describe("isShipmentDelayed", () => {
  const now = new Date("2026-07-18T12:00:00Z");
  it("atrasado si pasó la ETA y no ha arribado", () => {
    expect(isShipmentDelayed("on_water", "2026-07-10", now)).toBe(true);
    expect(isShipmentDelayed("at_port", "2026-07-10", now)).toBe(true);
  });
  it("no atrasado si arribó/entregó, ETA futura o sin ETA", () => {
    expect(isShipmentDelayed("arrived", "2026-07-10", now)).toBe(false);
    expect(isShipmentDelayed("delivered", "2026-07-10", now)).toBe(false);
    expect(isShipmentDelayed("on_water", "2026-08-01", now)).toBe(false);
    expect(isShipmentDelayed("on_water", null, now)).toBe(false);
  });
});
