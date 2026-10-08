import { describe, expect, it } from "vitest";
import { parseModuleEntitlements } from "./moduleEntitlements";

describe("server module entitlements", () => {
  it("denies missing and malformed responses", () => {
    const invalid = [
      null,
      undefined,
      {},
      [],
      { unrestricted: true },
      { unrestricted: "true", modules: [] },
      { unrestricted: true, modules: [{ key: "unknown" }] },
    ];
    for (const data of invalid) {
      expect(parseModuleEntitlements(data, null)).toEqual({
        unrestricted: false,
        modules: [],
      });
    }
  });

  it("denies an RPC error even when data grants unrestricted access", () => {
    const data = { unrestricted: true, modules: [] };
    const error = { message: "lookup failed" };
    expect(parseModuleEntitlements(data, error)).toEqual({
      unrestricted: false,
      modules: [],
    });
  });

  it("preserves explicitly granted unrestricted access", () => {
    const data = { unrestricted: true, modules: [] };
    expect(parseModuleEntitlements(data, null)).toEqual({
      unrestricted: true,
      modules: [],
    });
  });

  it("preserves restricted module grants without promoting other modules", () => {
    const data = {
      unrestricted: false,
      modules: [{ key: "capital" }, { key: "capital" }, { key: "catastro" }],
    };
    expect(parseModuleEntitlements(data, null)).toEqual({
      unrestricted: false,
      modules: ["capital", "catastro"],
    });
  });

  it("preserves an explicit denial", () => {
    const data = { unrestricted: false, modules: [] };
    expect(parseModuleEntitlements(data, null)).toEqual({
      unrestricted: false,
      modules: [],
    });
  });
});
