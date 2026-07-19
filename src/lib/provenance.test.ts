import { describe, expect, it } from "vitest";
import {
  normalizeProvenance,
  normalizeSection,
  summarizeProvenance,
  PROVENANCE_STATES,
} from "./provenance";

describe("normalizeProvenance", () => {
  it("acepta estados válidos y cae a a_verificar", () => {
    expect(normalizeProvenance("certificado")).toBe("certificado");
    expect(normalizeProvenance("DECLARADO")).toBe("declarado");
    expect(normalizeProvenance("inventado")).toBe("a_verificar");
    expect(normalizeProvenance(null)).toBe("a_verificar");
  });
  it("cubre los tres estados", () => {
    expect(PROVENANCE_STATES).toEqual(["certificado", "declarado", "a_verificar"]);
  });
});

describe("normalizeSection", () => {
  it("acepta secciones conocidas y cae a otro", () => {
    expect(normalizeSection("catastro")).toBe("catastro");
    expect(normalizeSection("Tierras_Raras")).toBe("tierras_raras");
    expect(normalizeSection("marketing")).toBe("otro");
  });
});

describe("summarizeProvenance", () => {
  it("cuenta por estado y calcula % certificado", () => {
    const s = summarizeProvenance([
      { provenance: "certificado" },
      { provenance: "certificado" },
      { provenance: "declarado" },
      { provenance: "a_verificar" },
      { provenance: "basura" }, // → a_verificar
    ]);
    expect(s.total).toBe(5);
    expect(s.certificado).toBe(2);
    expect(s.declarado).toBe(1);
    expect(s.aVerificar).toBe(2);
    expect(s.certifiedPct).toBe(40);
  });
  it("lista vacía", () => {
    expect(summarizeProvenance([])).toEqual({
      total: 0,
      certificado: 0,
      declarado: 0,
      aVerificar: 0,
      certifiedPct: 0,
    });
  });
});
