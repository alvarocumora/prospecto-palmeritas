import { describe, expect, it } from "vitest";
import type { ProjectDoc } from "./model";
import { appendixTables, mainBlocks, validateNarrativeDensity } from "./narrative";

function fixture(): ProjectDoc {
  return {
    code: "TEST",
    name: "Test Project",
    subtitle: "Exploration",
    commodity: "Cu",
    stage: "Exploration",
    location: "Chile",
    liveUrl: "https://example.com",
    docVersion: "v1",
    tags: [],
    kpis: [],
    thesis: [],
    sections: [
      {
        eyebrow: "Geología",
        title: "Interpretación",
        blocks: [
          { kind: "narrative", body: "Narrativa principal." },
          {
            kind: "appendixTable",
            title: "Dataset completo",
            head: ["ID", "Valor"],
            rows: [["A", "1"]],
          },
        ],
      },
    ],
    disclaimers: [],
  };
}

describe("narrative report engine", () => {
  it("keeps appendix tables out of the main narrative", () => {
    const model = fixture();
    expect(mainBlocks(model.sections[0])).toHaveLength(1);
    expect(appendixTables(model)).toHaveLength(1);
  });

  it("flags table-heavy sections instead of silently rewriting them", () => {
    const model = fixture();
    model.sections[0].blocks.push({
      kind: "table",
      head: ["A"],
      rows: Array.from({ length: 9 }, (_, index) => [String(index)]),
    });
    expect(validateNarrativeDensity(model)).toContain("INLINE_TABLE_TOO_LONG:Interpretación:9");
  });
});
