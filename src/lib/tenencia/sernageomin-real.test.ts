import { describe, it, expect } from "vitest";
import { normalizeToWgs84 } from "./import";
import { wgs84ToUtm } from "./datum";

// Datos reales del catastro oficial SERNAGEOMIN (appsngmaz.sernageomin.cl,
// actualizado 23-jul-2026), capturados de screenshots IMG_2313 / IMG_2316.
// Vértices en PSAD56 huso 19S (Este, Norte). Sirven para validar la cadena
// datum→import sobre coordenadas autoritativas (no sintéticas).
const ROMERO_I: [number, number][] = [
  [310600.0, 6127400.0], // L1
  [312600.0, 6127400.0], // L2
  [312600.0, 6126400.0], // L3
  [310600.0, 6126400.0], // L4
  [310600.0, 6127400.0], // cierre
];
const CLAUDIA: [number, number][] = [
  [307608.87, 6122456.24], // VA
  [310013.83, 6121773.46], // VB
  [309740.72, 6120811.48], // VC
  [307335.76, 6121494.26], // VD
  [307608.87, 6122456.24], // cierre
];

const CHILE_BOUNDS = { lonMin: -76, lonMax: -66, latMin: -56, latMax: -17 };

describe("tenencia · data real SERNAGEOMIN (PSAD56 19S)", () => {
  it("normaliza ROMERO I 1/40 a WGS84 dentro de Chile y sin warnings de CRS", () => {
    const { featureCollection, report } = normalizeToWgs84(
      { type: "Polygon", coordinates: [ROMERO_I] },
      { kind: "utm", datum: "PSAD56", huso: 19 },
    );
    expect(report.warnings).toHaveLength(0);
    const ring = (featureCollection.features[0].geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring).toHaveLength(5);
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThan(CHILE_BOUNDS.lonMin);
      expect(lon).toBeLessThan(CHILE_BOUNDS.lonMax);
      expect(lat).toBeGreaterThan(CHILE_BOUNDS.latMin);
      expect(lat).toBeLessThan(CHILE_BOUNDS.latMax);
    }
  });

  it("round-trip PSAD56→WGS84→PSAD56 recupera los vértices oficiales (<0,5 m)", () => {
    for (const concession of [ROMERO_I, CLAUDIA]) {
      const { featureCollection } = normalizeToWgs84(
        { type: "Polygon", coordinates: [concession] },
        { kind: "utm", datum: "PSAD56", huso: 19 },
      );
      const ring = (featureCollection.features[0].geometry as GeoJSON.Polygon).coordinates[0];
      ring.forEach(([lon, lat], i) => {
        const back = wgs84ToUtm([lon, lat], "PSAD56", 19);
        expect(Math.abs(back.e - concession[i][0])).toBeLessThan(0.5);
        expect(Math.abs(back.n - concession[i][1])).toBeLessThan(0.5);
      });
    }
  });
});
