import { describe, expect, it } from "vitest";
import { STRINGS, fill } from "./i18n";

describe("STRINGS (diccionario i18n)", () => {
  it("todas las claves tienen es, en y pt no vacíos", () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      for (const locale of ["es", "en", "pt"] as const) {
        expect(entry[locale], `${key}.${locale}`).toBeTruthy();
        expect(typeof entry[locale], `${key}.${locale}`).toBe("string");
      }
    }
  });

  it("los placeholders {var} coinciden entre idiomas", () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      const vars = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
      expect(vars(entry.en), `${key} en-vars`).toBe(vars(entry.es));
      expect(vars(entry.pt), `${key} pt-vars`).toBe(vars(entry.es));
    }
  });
});

describe("fill", () => {
  it("interpola variables", () => {
    expect(fill("hola {name}", { name: "mundo" })).toBe("hola mundo");
    expect(fill("{a} y {b}", { a: "1", b: "2" })).toBe("1 y 2");
  });
  it("deja el placeholder si falta la variable", () => {
    expect(fill("hola {name}", {})).toBe("hola {name}");
  });
});
