import { describe, expect, it, vi } from "vitest";
import {
  createRequestId,
  createRequestIdHeaders,
  getOrCreateRequestId,
  isValidRequestId,
  normalizeRequestId,
  requestIdHeaderName,
} from "./requestId";

describe("request id utilities", () => {
  it("validates request ids", () => {
    expect(isValidRequestId("geo:12345678")).toBe(true);
    expect(isValidRequestId("tenant.sync:abc-1234")).toBe(true);
    expect(isValidRequestId(" short ")).toBe(false);
    expect(isValidRequestId("bad value with spaces")).toBe(false);
    expect(isValidRequestId(null)).toBe(false);
  });

  it("normalizes valid ids and rejects invalid values", () => {
    expect(normalizeRequestId("  geo:abc-1234  ")).toBe("geo:abc-1234");
    expect(normalizeRequestId("bad value")).toBeNull();
    expect(normalizeRequestId(undefined)).toBeNull();
  });

  it("creates ids with sanitized scopes", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    expect(createRequestId("Tenant Sync")).toBe("tenant-sync:00000000-0000-4000-8000-000000000001");
    expect(createRequestId("***")).toBe("geo:00000000-0000-4000-8000-000000000001");

    vi.restoreAllMocks();
  });

  it("gets an existing valid id or creates a new one", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");

    expect(getOrCreateRequestId("geo:existing-1234")).toBe("geo:existing-1234");
    expect(getOrCreateRequestId("bad value", "jobs")).toBe(
      "jobs:00000000-0000-4000-8000-000000000002",
    );

    vi.restoreAllMocks();
  });

  it("creates request id headers", () => {
    expect(createRequestIdHeaders("geo:abc-1234")).toEqual({
      [requestIdHeaderName]: "geo:abc-1234",
    });
    expect(() => createRequestIdHeaders("bad value")).toThrow("Invalid request id");
  });
});
