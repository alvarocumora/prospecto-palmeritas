import { describe, expect, it } from "vitest";
import {
  normalizeConcessionType,
  normalizeConcessionStatus,
  validateGeoJsonPolygon,
  totalAreaHa,
} from "./concessions";

describe("normalizadores de concesión", () => {
  it("tipo y estado caen a 'otro' ante lo desconocido", () => {
    expect(normalizeConcessionType("cateo")).toBe("cateo");
    expect(normalizeConcessionType("MINA")).toBe("mina");
    expect(normalizeConcessionType("zzz")).toBe("otro");
    expect(normalizeConcessionStatus("vigente")).toBe("vigente");
    expect(normalizeConcessionStatus("caducada")).toBe("caducada");
    expect(normalizeConcessionStatus("???")).toBe("otro");
  });
});

describe("validateGeoJsonPolygon", () => {
  it("vacío es válido (sin polígono)", () => {
    expect(validateGeoJsonPolygon("")).toEqual({
      ok: true,
      geometry: null,
      vertexCount: 0,
      error: null,
    });
  });

  it("JSON inválido falla", () => {
    expect(validateGeoJsonPolygon("{no-json").ok).toBe(false);
  });

  it("Polygon cerrado cuenta vértices sin el cierre", () => {
    const poly = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [-64, -22],
          [-64.1, -22],
          [-64.1, -22.1],
          [-64, -22.1],
          [-64, -22],
        ],
      ],
    });
    const r = validateGeoJsonPolygon(poly);
    expect(r.ok).toBe(true);
    expect(r.vertexCount).toBe(4);
    expect(r.geometry?.type).toBe("Polygon");
  });

  it("acepta Feature y extrae la geometría", () => {
    const feat = JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    });
    const r = validateGeoJsonPolygon(feat);
    expect(r.ok).toBe(true);
    expect(r.vertexCount).toBe(3);
  });

  it("rechaza polígono con menos de 3 vértices", () => {
    const bad = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    });
    expect(validateGeoJsonPolygon(bad).ok).toBe(false);
  });

  it("rechaza tipos no soportados (Point)", () => {
    expect(validateGeoJsonPolygon(JSON.stringify({ type: "Point", coordinates: [0, 0] })).ok).toBe(
      false,
    );
  });
});

describe("totalAreaHa", () => {
  it("suma áreas válidas e ignora nulos", () => {
    expect(totalAreaHa([{ area_ha: 6250 }, { area_ha: null }, { area_ha: 100 }])).toBe(6350);
    expect(totalAreaHa([])).toBe(0);
  });
});
