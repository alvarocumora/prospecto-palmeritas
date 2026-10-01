import { describe, expect, it } from "vitest";
import { buildCholquiDoc } from "./cholqui";
import { appendixTables, validateNarrativeDensity } from "../narrative";

describe("Cholqui narrative report", () => {
  it("keeps the main technical narrative free of table-heavy sections", () => {
    const model = buildCholquiDoc();
    expect(validateNarrativeDensity(model)).toEqual([]);
    expect(
      model.sections.flatMap((section) => section.blocks).filter((block) => block.kind === "table"),
    ).toHaveLength(0);
  });

  it("moves detailed analytical data to appendices", () => {
    const model = buildCholquiDoc();
    const appendices = appendixTables(model);
    expect(appendices.length).toBeGreaterThanOrEqual(2);
    expect(appendices.some(({ block }) => block.title === "Resultados analíticos completos")).toBe(
      true,
    );
  });

  it("uses explicit narrative, evidence, findings and gaps", () => {
    const blocks = buildCholquiDoc().sections.flatMap((section) => section.blocks);
    expect(blocks.some((block) => block.kind === "narrative")).toBe(true);
    expect(blocks.some((block) => block.kind === "evidence")).toBe(true);
    expect(blocks.some((block) => block.kind === "finding")).toBe(true);
    expect(blocks.some((block) => block.kind === "gap")).toBe(true);
    expect(blocks.some((block) => block.kind === "recommendation")).toBe(true);
  });
  it("includes Toki 2 as a ground-truth program, not a resource estimate", () => {
    const model = buildCholquiDoc();
    const section = model.sections.find((item) => item.title.includes("Toki 2"));
    expect(section).toBeDefined();
    const blocks = section?.blocks ?? [];
    expect(blocks.some((block) => block.kind === "recommendation")).toBe(true);
    expect(blocks.some((block) => block.kind === "gap")).toBe(true);
    const appendix = blocks.find((block) => block.kind === "appendixTable");
    expect(appendix && appendix.kind === "appendixTable" ? appendix.rows : []).toHaveLength(9);
    expect(JSON.stringify(section)).toContain("no confirma ni descarta mineralización");
  });
});
