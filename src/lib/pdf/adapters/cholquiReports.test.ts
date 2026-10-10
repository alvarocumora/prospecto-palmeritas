import { describe, expect, it } from "vitest";
import drillRaw from "@/data/geo/cholqui_drill_grid.geojson?raw";
import { parsePublishedDrillGrid, totalMeters } from "@/lib/cholqui/drillGrid";
import type { CholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { buildCholquiDoc } from "./cholqui";
import { buildCholquiTargetsDoc } from "./cholquiTargets";
import { buildCholquiInvestmentDoc } from "./cholquiInvestment";
import { appendixTables } from "../narrative";

const collars = parsePublishedDrillGrid(JSON.parse(drillRaw));
const data: CholquiSatelliteTargets = {
  runDate: "",
  coverage: {
    sensor: "Sentinel-2 L2A", scenesUsed: 2, typicalPct: 28.9, bestCasePct: 49.2,
    conclusive: true, headline: "", tenureNote: "",
  },
  anomalies: [{
    id: "CHQ-SAT-42", indexCode: "CLAY_MINERALS", severity: "alta",
    score: 0.8, areaHa: 1, notes: null, detectedAt: null, withinTenure: true,
    lat: -33.85, lng: -71.04, ring: [], distanceToCenterM: 10,
    zScore: 4, provenance: "DERIVADO",
  }],
  collars,
  summary: {
    anomalies: 1, withinTenure: 1, outsideTenure: 0, drillable: 1,
    collars: collars.length, totalMeters: totalMeters(collars), maxScore: 0.8,
    indexes: [{ code: "CLAY_MINERALS", count: 1 }],
  },
};

describe("Cholqui reports share published evidence", () => {
  it("uses published orientations and stable candidate identifiers in targets PDF", () => {
    const doc = buildCholquiTargetsDoc(data);
    const content = JSON.stringify(doc);
    expect(content).not.toContain("110° / 290°");
    expect(content).not.toContain("290°/110°");
    expect(doc.chart?.data[0].label).toBe("CHQ-SAT-42");
    const plan = doc.sections.find((section) => section.title === "Malla de sondajes de fase 1");
    const metadata = plan?.blocks.find((block) => block.kind === "kv");
    expect(metadata?.kind === "kv" ? metadata.items : []).toContainEqual(["Azimut publicado", "105° / 285°"]);
    expect(content).toContain("no existe enlace de anomalía informado");
  });

  it("includes the same seven collars and 1,070 m in the technical report", () => {
    const doc = buildCholquiDoc();
    const table = appendixTables(doc).find((item) => item.block.title === "Collares de la propuesta publicada")!.block;
    expect(table.rows).toHaveLength(7);
    expect(table.rows.reduce((sum, row) => sum + Number(row[5]), 0)).toBe(1070);
    expect(table.rows[0][0]).toBe("CHO-DDH-01");
    expect(JSON.stringify(doc)).toContain("Snapshot de campaña no adjunto");
  });

  it("preserves monthly economics as scenario appendices and leaves investment returns pending", () => {
    const doc = buildCholquiInvestmentDoc();
    expect(doc.reportProfile).toBe("investment");
    const monthly = appendixTables(doc).filter((item) => item.block.title.startsWith("Flujo mensual de escenario"));
    expect(monthly).toHaveLength(2);
    for (const item of monthly) {
      expect(item.block.rows).toHaveLength(24);
      expect(item.block.provenance).toBe("SCENARIO");
    }
    expect(JSON.stringify(doc)).toContain("payback de decisión");
    expect(appendixTables(doc).some((item) => item.block.title === "Garantías documentadas")).toBe(true);
    expect(buildCholquiInvestmentDoc(true).docVersion).not.toBe(doc.docVersion);
  });
});
