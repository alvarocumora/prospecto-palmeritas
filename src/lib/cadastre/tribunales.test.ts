import { describe, it, expect } from "vitest";
import { suggestTribunal } from "./tribunales";

describe("suggestTribunal", () => {
  it("San Pedro va al Juzgado de Letras de Melipilla", () => {
    expect(suggestTribunal("SAN PEDRO")).toEqual({ tribunal: "Juzgado de Letras de Melipilla", known: true });
  });
  it("Salamanca va a Illapel (sin tildes/mayúsculas)", () => {
    expect(suggestTribunal("salamanca").tribunal).toBe("Juzgado de Letras de Illapel");
  });
  it("comuna desconocida no inventa tribunal", () => {
    expect(suggestTribunal("Pucón")).toEqual({ tribunal: "[TRIBUNAL COMPETENTE]", known: false });
    expect(suggestTribunal(null).known).toBe(false);
  });
});
