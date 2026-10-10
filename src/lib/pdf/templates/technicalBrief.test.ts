import { jsPDF } from "jspdf";
import { describe, expect, it, vi } from "vitest";
import { buildCholquiDoc } from "../adapters/cholqui";
import { section } from "../brand/institutional";
import { GC_PAGE } from "../brand/tokens";
import { renderTechnicalBrief } from "./technicalBrief";

vi.mock("../brand/kit", async (importOriginal) => {
  const kit = await importOriginal<typeof import("../brand/kit")>();
  return { ...kit, brandQr: async () => kit.MARK_PNG };
});

describe("technical report pagination", () => {
  it("emits one final folio per page after removing the unused index leaf", async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const text = vi.spyOn(doc, "text");
    await renderTechnicalBrief(doc, buildCholquiDoc());
    const total = doc.getNumberOfPages();
    const folios = text.mock.calls
      .map((call) => call[0])
      .filter((value) => typeof value === "string" && value.startsWith("Página "));
    expect(total).toBeGreaterThan(3);
    expect(folios).toEqual(
      Array.from({ length: total }, (_, index) => `Página ${index + 1} de ${total}`),
    );
  });

  it("keeps appendix labels clear of the institutional section heading", () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const text = vi.spyOn(doc, "text");
    section(doc, GC_PAGE.a4, 100, "Anexo B", "Informe técnico");
    const appendix = text.mock.calls.find((call) => call[0] === "Anexo B")!;
    const heading = text.mock.calls.find((call) => call[0] === "INFORME TÉCNICO")!;
    expect(heading[1]).toBeGreaterThanOrEqual(
      Number(appendix[1]) + doc.getTextWidth("Anexo B") + 10,
    );
  });

  it("keeps the collar appendix title and its first row on the same page", async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const original = doc.text.bind(doc);
    const pages: number[] = [];
    const text = vi.spyOn(doc, "text").mockImplementation((...args) => {
      pages.push(doc.getCurrentPageInfo().pageNumber);
      return original(...args);
    });
    await renderTechnicalBrief(doc, buildCholquiDoc());
    const title = text.mock.calls.findIndex(
      (call) => call[0] === "Collares de la propuesta publicada",
    );
    const firstRow = text.mock.calls.findIndex((call) => call[0] === "CHO-DDH-01");
    expect(title).toBeGreaterThan(-1);
    expect(firstRow).toBeGreaterThan(title);
    expect(pages[firstRow]).toBe(pages[title]);
  });
});
