import { describe, expect, it } from "vitest";
import csv from "../../../reports/nahuelbuta/2026-10-27/ranking_by_pano.csv?raw";
import panosRaw from "@/data/geo/losalamos_panos_arcillas.geojson?raw";
import { buildPriorityZones, parseRanking, summarizeZones } from "./prospectivity";

describe("zonas de prioridad Nahuelbuta", () => {
  const ranking = parseRanking(csv);
  it("lee los 34 paños y 8 de prioridad A", () => {
    expect(ranking).toHaveLength(34);
    expect(summarizeZones(ranking).A).toHaveLength(8);
  });
  it("une cada paño con su geometría", () => {
    const fc = buildPriorityZones(JSON.parse(panosRaw), ranking);
    expect(fc.features).toHaveLength(34);
    const a26 = fc.features.find((f) => f.properties?.nombre?.startsWith("Arcillas 26 "));
    expect(a26?.properties?.prioridad).toBe("A");
  });
});
