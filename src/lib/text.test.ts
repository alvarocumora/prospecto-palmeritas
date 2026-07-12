import { describe, expect, it } from "vitest";
import { hash32, normalizeAlnum } from "./text";

describe("hash32", () => {
  it("es determinista y hexadecimal", () => {
    expect(hash32("abc")).toBe(hash32("abc"));
    expect(hash32("abc")).toMatch(/^[0-9a-f]+$/);
  });
  it("distingue entradas distintas", () => {
    expect(hash32("2026|111-2|C-9")).not.toBe(hash32("2025|111-2|C-9"));
  });
  it("cadena vacía no rompe", () => {
    expect(typeof hash32("")).toBe("string");
  });
});

describe("normalizeAlnum", () => {
  it("quita acentos, pasa a mayúsculas y deja solo alfanuméricos", () => {
    expect(normalizeAlnum("Minera Los Andes S.A.")).toBe("MINERALOSANDESSA");
    expect(normalizeAlnum("O'Higgins")).toBe("OHIGGINS");
    expect(normalizeAlnum("Copiapó")).toBe("COPIAPO");
  });
  it("maneja null/undefined/vacío", () => {
    expect(normalizeAlnum(null)).toBe("");
    expect(normalizeAlnum(undefined)).toBe("");
    expect(normalizeAlnum("")).toBe("");
  });
  it("normaliza RUT a solo dígitos y K", () => {
    expect(normalizeAlnum("76.123.456-7")).toBe("761234567");
    expect(normalizeAlnum("12.345.678-K")).toBe("12345678K");
  });
});
