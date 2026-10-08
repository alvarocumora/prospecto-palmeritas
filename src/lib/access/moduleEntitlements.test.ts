import { describe, expect, it } from "vitest";
import { parseModuleEntitlements } from "./moduleEntitlements";

describe("server module entitlements", () => {
  it("denies missing and malformed responses", () => {
    for (const data of [null, undefined, {}, [], { unrestricted: true }, {
      unrestricted: "true",
      modules: [],
    }, { unrestricted: true, modules: [{ key: "unknown" }] }]) {
      expect(parseModuleEntitlements(data, null)).toEqual({
        unrestricted: false,
        modules: [],
      });
    }
  });

  it("denies an RPC error even when data grants unrestricted access", () => {
    expect(parseModuleEntitlements({
      unrestricted: true,
      modules: [],
    }, { message: "lookup failed" })).toEqual({ unrestricted: false, modules: [] });
  });

  it("preserves explicitly granted unrestricted access", () => {
    expect(parseModuleEntitlements({ unrestricted: true, modules: [] }, null)).toEqual({
      unrestricted: true,
      modules: [],
    });
  });

  it("preserves restricted module grants without promoting other modules", () => {
    expect(parseModuleEntitlements({
      unrestricted: false,
      modules: [{ key: "capital" }, { key: "capital" }, { key: "catastro" }],
    }, null)).toEqual({ unrestricted: false, modules: ["capital", "catastro"] });
  });

  it("preserves an explicit denial", () => {
    expect(parseModuleEntitlements({ unrestricted: false, modules: [] }, null)).toEqual({
      unrestricted: false,
      modules: [],
    });
  });
});
