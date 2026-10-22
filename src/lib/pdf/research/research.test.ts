import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { buildResearchDoc, availability } from "./projects";
import { findDiscrepancies } from "./discrepancies";
import { integrityProblems, publicExportBlocked, RS_COLOR, RS_TYPE } from "./model";
import { renderResearchDoc } from "./render";

function render(family: "memo" | "factsheet" | "technical", project: "cholqui" | "losverdes" = "cholqui") {
  const model = buildResearchDoc(family, project, "22 de octubre de 2026")!;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const sizes: number[] = [];
  const orig = doc.setFontSize.bind(doc);
  doc.setFontSize = ((s: number) => {
    sizes.push(s);
    return orig(s);
  }) as typeof doc.setFontSize;
  const report = renderResearchDoc(doc, model);
  return { model, report, sizes, raw: doc.output() };
}

describe("research documents", () => {
  it("uses the exact platform palette", () => {
    expect(RS_COLOR.paper).toEqual([247, 245, 240]);
    expect(RS_COLOR.ink).toEqual([26, 26, 46]);
    expect(RS_COLOR.cobalt).toEqual([43, 74, 203]);
  });

  it("Cholqui memorandum has exactly four pages, no overflow, no text below 7.5 pt", () => {
    const { report, sizes } = render("memo");
    expect(report.pages).toBe(4);
    expect(report.overflow).toEqual([]);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(RS_TYPE.note);
  });

  it("fact sheet is one page and technical report renders without overflow", () => {
    expect(render("factsheet").report).toEqual({ pages: 1, overflow: [] });
    expect(render("factsheet", "losverdes").report.overflow).toEqual([]);
    expect(render("technical").report.overflow).toEqual([]);
  });

  it("flags round-size and sample-count conflicts and blocks public export", () => {
    const ids = findDiscrepancies("cholqui").map((d) => d.id);
    expect(ids).toContain("cholqui-round-size");
    const memo = buildResearchDoc("memo", "cholqui")!;
    expect(publicExportBlocked(memo)).toBe(true);
    expect(memo.terms.find((t) => t.label === "Tamaño de la ronda")?.conflictId).toBe("cholqui-round-size");
  });

  it("flags the Los Verdes minimum ticket conflict (15k vs 50k)", () => {
    const d = findDiscrepancies("losverdes").find((x) => x.id === "losverdes-min-ticket");
    expect(d?.documentValue).toContain("15");
    expect(d?.platformValue).toContain("50");
    expect(d?.blocking).toBe(true);
  });

  it("16.23 % Cu is presented as a measured maximum of point samples, not a grade", () => {
    const p = buildResearchDoc("memo", "cholqui")!.params.find((x) => x.label === "Cu total máximo")!;
    expect(p.value).toBe("16,23 %");
    expect(p.provenance).toBe("MEDIDO");
    expect(p.note).toMatch(/no es ley media/);
  });

  it("placements are declared and every figure has a source", () => {
    const memo = buildResearchDoc("memo", "cholqui")!;
    expect(memo.terms.find((t) => t.label === "Colocación declarada")).toMatchObject({ value: "47 %", provenance: "DECLARADO" });
    expect(integrityProblems(memo)).toEqual([]);
  });

  it("no synthetic returns in any document", () => {
    const { raw } = render("memo");
    expect(raw).not.toMatch(/\bTIR\b|\bIRR\b|\bROI\b|múltiplo/i);
  });

  it("quarterly update and investor statement are unavailable, not fabricated", () => {
    expect(availability("quarterly", "cholqui").ok).toBe(false);
    expect(availability("statement", "cholqui").ok).toBe(false);
    expect(buildResearchDoc("quarterly", "cholqui")).toBeNull();
  });
});
