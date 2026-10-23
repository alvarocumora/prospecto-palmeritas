import { jsPDF } from "jspdf";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDoc } from "../model";
import { GC_PAGE } from "../brand/tokens";
import { renderOnePager } from "./onePager";

vi.mock("../brand/kit", async (importOriginal) => {
  const kit = await importOriginal<typeof import("../brand/kit")>();
  return { ...kit, brandQr: async () => kit.MARK_PNG };
});

const base: ProjectDoc = {
  code: "GC-TEST-01",
  name: "Proyecto de referencia",
  subtitle: "Cu · estudio",
  commodity: "Cu",
  stage: "Estudio",
  location: "Chile",
  liveUrl: "https://geocapitals.com/terminal/cholqui",
  docVersion: "v1",
  tags: [],
  kpis: [
    { label: "Superficie declarada", value: "3.303 ha", note: "Antecedente del titular" },
    { label: "Ronda referencial", value: "USD 1,5 M" },
    { label: "Acciones", value: "15.000" },
  ],
  thesis: ["Antecedentes preliminares y sujetos a revisión técnica."],
  sections: [],
  disclaimers: ["Cifras declaradas, no auditadas. No se han definido recursos ni reservas."],
  contact: { email: "contacto@geocapitals.com" },
};

function newDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

describe("investment one-pager layout", () => {
  it("keeps a concise factsheet on one A4 sheet", async () => {
    const doc = newDoc();
    const text = vi.spyOn(doc, "text");
    await renderOnePager(doc, base);
    expect(doc.getNumberOfPages()).toBe(1);
    const printed = text.mock.calls.map((c) => c[0]);
    expect(printed).toContain("ABRIR FICHA Y MAPA");
    expect(printed).toContain("CONTACTO Y SIGUIENTE PASO");
    expect(printed).toContain("GEOCAPITALS · GC-TEST-01 · v1");
  });

  it("preserves long legal language on continuation pages instead of clipping it", async () => {
    const doc = newDoc();
    const positions: Array<{ page: number; y: number }> = [];
    const original = doc.text.bind(doc);
    const text = vi.spyOn(doc, "text").mockImplementation((...args) => {
      if (typeof args[2] === "number") {
        positions.push({ page: doc.getCurrentPageInfo().pageNumber, y: args[2] });
      }
      return original(...args);
    });
    const legal = "El capital está expuesto a riesgo de pérdida y la información requiere debida diligencia. ".repeat(40);
    await renderOnePager(doc, { ...base, disclaimers: [legal] });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(text.mock.calls.some((call) => call[0] === "ADVERTENCIAS COMPLETAS")).toBe(true);
    expect(positions.every(({ y }) => y > 0 && y < GC_PAGE.a4.h)).toBe(true);
  });

  it("identifies the origin of GIS imagery and moves long technical captions to notes", async () => {
    const doc = newDoc();
    const text = vi.spyOn(doc, "text");
    await renderOnePager(doc, {
      ...base,
      map: {
        title: "Catastro",
        points: [],
        source: "Catastro oficial",
        imagery: "Esri World Imagery",
        crs: "EPSG:4326",
        caption: "Cobertura cartográfica de referencia, no una validación de dominio.",
      },
    });
    expect(doc.getNumberOfPages()).toBe(2);
    expect(
      text.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("Esri World Imagery"),
      ),
    ).toBe(true);
    expect(text.mock.calls.some((c) => c[0] === "NOTA CARTOGRÁFICA")).toBe(true);
  });
});
