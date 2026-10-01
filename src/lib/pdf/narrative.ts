import type { DocBlock, DocSection, ProjectDoc } from "./model";

export const MAX_INLINE_TABLE_ROWS = 8;

export function isAppendixTable(
  block: DocBlock,
): block is Extract<DocBlock, { kind: "appendixTable" }> {
  return block.kind === "appendixTable";
}

export function mainBlocks(section: DocSection): DocBlock[] {
  return section.blocks.filter((block) => block.kind !== "appendixTable");
}

export function appendixTables(model: ProjectDoc): Array<{
  sectionTitle: string;
  block: Extract<DocBlock, { kind: "appendixTable" }>;
}> {
  return model.sections.flatMap((section) =>
    section.blocks.filter(isAppendixTable).map((block) => ({ sectionTitle: section.title, block })),
  );
}

export function blockMetaLine(block: DocBlock): string | null {
  if (!("provenance" in block) && !("source" in block) && !("confidence" in block)) return null;

  const parts: string[] = [];
  if ("provenance" in block && block.provenance) parts.push(block.provenance);
  if ("confidence" in block && block.confidence) {
    parts.push(`confidence: ${block.confidence.toUpperCase()}`);
  }
  if ("source" in block && block.source) parts.push(`source: ${block.source}`);
  return parts.length ? parts.join(" · ") : null;
}

export function validateNarrativeDensity(model: ProjectDoc): string[] {
  const issues: string[] = [];

  for (const section of model.sections) {
    const inlineTables = section.blocks.filter((block) => block.kind === "table");
    if (inlineTables.length > 1) {
      issues.push(`MULTIPLE_INLINE_TABLES:${section.title}:${inlineTables.length}`);
    }

    for (const table of inlineTables) {
      if (table.kind === "table" && table.rows.length > MAX_INLINE_TABLE_ROWS) {
        issues.push(`INLINE_TABLE_TOO_LONG:${section.title}:${table.rows.length}`);
      }
    }
  }

  return issues;
}
