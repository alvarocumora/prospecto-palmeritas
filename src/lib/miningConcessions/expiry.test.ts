import { describe, expect, it, vi } from "vitest";
import { daysUntilExpiry, expiryStatus } from "./expiry";

describe("mining concession expiry utilities", () => {
  it("returns null for missing expiry dates", () => {
    expect(daysUntilExpiry(null)).toBeNull();
    expect(expiryStatus(null)).toBe("none");
  });

  it("classifies expired, critical, warning, and ok dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));

    expect(expiryStatus("2026-05-09T00:00:00Z")).toBe("expired");
    expect(expiryStatus("2026-05-20T00:00:00Z")).toBe("critical");
    expect(expiryStatus("2026-07-01T00:00:00Z")).toBe("warning");
    expect(expiryStatus("2026-10-01T00:00:00Z")).toBe("ok");

    vi.useRealTimers();
  });
});
