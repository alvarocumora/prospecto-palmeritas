import { describe, expect, it } from "vitest";
import { buildNahuelbutaDoc, nahuelbutaMesetas, NAHUELBUTA_DOC_VERSION } from "./nahuelbuta";

describe("Nahuelbuta preliminary technical PDF", () => {
  it("uses exact historical coverage provenance and never claims an REE assay", () => {
    const doc = buildNahuelbutaDoc();
    expect(NAHUELBUTA_DOC_VERSION).toBe("v1.1");
    expect(doc.reportProfile).toBe("technical");
    expect(doc.kpis.some((k) => k.label === "Teledetección óptica" && k.value === "No concluyente")).toBe(true);
    expect(doc.dataQuality?.some((f) => f.label === "Cobertura óptica histórica" && f.detail.includes("AOI rectangular"))).toBe(true);
    const section = doc.sections.find((x) => x.eyebrow === "Teledetección y calidad");
    expect(section?.blocks.some((b) => b.kind === "finding" && b.body.includes("10.200 ha"))).toBe(true);
    expect(doc.disclaimers.some((s) => s.includes("GEO-2026-004"))).toBe(true);
  });

  it("ranks polygons by DEM mesa fraction without treating it as grade", () => {
    const rows = nahuelbutaMesetas();
    expect(rows).toHaveLength(34);
    expect(rows[0]).toEqual({ pano: "Arcillas 26", pct: 45.4 });
    expect(rows[1]).toEqual({ pano: "Arcillas 34", pct: 45.2 });
    const doc = buildNahuelbutaDoc();
    const section = doc.sections.find((x) => x.eyebrow === "Priorización geomorfológica");
    expect(section).toBeDefined();
    expect(section?.blocks.some((b) => b.kind === "table" && b.rows[0][0] === "Arcillas 26")).toBe(true);
    const lineaments = doc.sections.find((x) => x.eyebrow === "Lineamientos DEM");
    expect(lineaments?.blocks.some((b) => b.kind === "table" && b.rows.length === 8)).toBe(true);
    expect(lineaments?.blocks.some((b) => b.kind === "finding" && b.confidence === "low")).toBe(true);
    expect(JSON.stringify(section)).not.toMatch(/ppm|TREO\s+[0-9]+/i);
  });
});
