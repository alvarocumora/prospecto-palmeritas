import { describe, it, expect } from "vitest";
import { normalizeToWgs84, collectPolygons, looksGeographic } from "./import";
import { wgs84ToUtm } from "./datum";

function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6378137;
  const latm = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * (Math.PI / 180) * R * Math.cos(latm);
  const dy = (b[1] - a[1]) * (Math.PI / 180) * R;
  return Math.hypot(dx, dy);
}

// Polígono WGS84 real (Coquimbo, huso 19)
const wgsRing: [number, number][] = [
  [-71.3, -29.95],
  [-71.28, -29.95],
  [-71.28, -29.93],
  [-71.3, -29.93],
  [-71.3, -29.95],
];

describe("tenencia/import · looksGeographic", () => {
  it("distingue lon/lat de UTM en metros", () => {
    expect(looksGeographic([-71.3, -29.95])).toBe(true);
    expect(looksGeographic([311314, 6252642])).toBe(false);
  });
});

describe("tenencia/import · collectPolygons", () => {
  it("extrae polígonos de FeatureCollection, Feature, Geometry y MultiPolygon", () => {
    const poly: GeoJSON.Polygon = { type: "Polygon", coordinates: [wgsRing] };
    expect(collectPolygons(poly)).toHaveLength(1);
    expect(collectPolygons({ type: "Feature", properties: null, geometry: poly })).toHaveLength(1);
    expect(
      collectPolygons({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { name: "a" }, geometry: poly },
          { type: "Feature", properties: null, geometry: { type: "Point", coordinates: [0, 0] } },
        ],
      }),
    ).toHaveLength(1); // el Point se ignora
    const mp: GeoJSON.MultiPolygon = { type: "MultiPolygon", coordinates: [[wgsRing]] };
    expect(collectPolygons(mp)).toHaveLength(1);
  });
});

describe("tenencia/import · normalizeToWgs84", () => {
  it("pasa WGS84 sin tocar las coordenadas", () => {
    const { featureCollection, report } = normalizeToWgs84(
      { type: "Polygon", coordinates: [wgsRing] },
      { kind: "wgs84" },
    );
    expect(report.polygons).toBe(1);
    const out = (featureCollection.features[0].geometry as GeoJSON.Polygon).coordinates[0][0];
    expect(out).toEqual(wgsRing[0]);
  });

  it("convierte un anillo PSAD56-UTM a WGS84 (round-trip <0,5 m)", () => {
    // Construye el anillo en PSAD56 UTM huso 19 a partir del WGS84 real.
    const psadRing = wgsRing.map((p) => {
      const u = wgs84ToUtm(p, "PSAD56", 19);
      return [u.e, u.n];
    });
    const { featureCollection } = normalizeToWgs84(
      { type: "Polygon", coordinates: [psadRing] },
      { kind: "utm", datum: "PSAD56", huso: 19 },
    );
    const out = (featureCollection.features[0].geometry as GeoJSON.Polygon).coordinates[0];
    out.forEach((pos, i) => {
      expect(metersBetween(pos as [number, number], wgsRing[i])).toBeLessThan(0.5);
    });
  });

  it("advierte cuando el CRS declarado no calza con las coordenadas", () => {
    const psadRing = wgsRing.map((p) => {
      const u = wgs84ToUtm(p, "PSAD56", 19);
      return [u.e, u.n];
    });
    // UTM real declarado como WGS84 → warning
    const r1 = normalizeToWgs84({ type: "Polygon", coordinates: [psadRing] }, { kind: "wgs84" });
    expect(r1.report.warnings.some((w) => /UTM/.test(w))).toBe(true);
    // lon/lat declarado como UTM → warning
    const r2 = normalizeToWgs84(
      { type: "Polygon", coordinates: [wgsRing] },
      { kind: "utm", datum: "PSAD56", huso: 19 },
    );
    expect(r2.report.warnings.some((w) => /lon\/lat/.test(w))).toBe(true);
  });
});
