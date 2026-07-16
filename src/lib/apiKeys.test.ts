import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  isApiKeyFormat,
  keyPrefix,
  hashApiKey,
  monthKey,
  checkQuota,
  API_PLAN_LIMITS,
} from "./apiKeys";

describe("generateApiKey / formato", () => {
  it("genera llaves con el formato correcto y únicas", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(isApiKeyFormat(a)).toBe(true);
    expect(isApiKeyFormat(b)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("rechaza formatos inválidos", () => {
    expect(isApiKeyFormat("")).toBe(false);
    expect(isApiKeyFormat("gc_live_corta")).toBe(false);
    expect(isApiKeyFormat("sk_live_" + "a".repeat(64))).toBe(false);
  });
  it("keyPrefix trunca para display", () => {
    const k = generateApiKey();
    expect(keyPrefix(k).startsWith("gc_live_")).toBe(true);
    expect(keyPrefix(k).length).toBe("gc_live_".length + 6);
  });
});

describe("hashApiKey", () => {
  it("es determinista y no reversible (sha256 hex)", async () => {
    const k = "gc_live_" + "ab".repeat(32);
    const h1 = await hashApiKey(k);
    const h2 = await hashApiKey(k);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toContain("gc_live_");
  });
});

describe("monthKey / checkQuota", () => {
  const july = new Date("2026-07-16T12:00:00Z");

  it("monthKey en UTC", () => {
    expect(monthKey(july)).toBe("2026-07");
  });

  it("permite bajo el límite del plan y bloquea al alcanzarlo", () => {
    const under = checkQuota("free", "2026-07", API_PLAN_LIMITS.free - 1, july);
    expect(under.allowed).toBe(true);
    const at = checkQuota("free", "2026-07", API_PLAN_LIMITS.free, july);
    expect(at.allowed).toBe(false);
    expect(at.limit).toBe(API_PLAN_LIMITS.free);
  });

  it("reinicia el contador al cambiar de mes", () => {
    const q = checkQuota("free", "2026-06", 999999, july);
    expect(q.allowed).toBe(true);
    expect(q.effectiveCount).toBe(0);
    expect(q.resetCounter).toBe(true);
  });

  it("plan desconocido cae al límite free", () => {
    expect(checkQuota("otro", "2026-07", 0, july).limit).toBe(API_PLAN_LIMITS.free);
  });
});
