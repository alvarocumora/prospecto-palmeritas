import { describe, expect, it } from "vitest";
import {
  ANOMALY_INTENSITY_COLOR_STOPS,
  anomalyIntensityColor,
  anomalySurfaceToFeatureCollection,
  buildAnomalySurface,
  type AnomalySurface,
} from "./anomalySurface";

const GRID_POINTS = [
  { lat: -33.85, lng: -71.0, value: 2 },
  { lat: -33.85, lng: -70.99, value: 2 },
  { lat: -33.84, lng: -71.0, value: 2 },
  { lat: -33.84, lng: -70.99, value: 8 },
];

describe("buildAnomalySurface", () => {
  it("retorna null con menos de minPoints (default 4) observaciones válidas", () => {
    expect(buildAnomalySurface(GRID_POINTS.slice(0, 3))).toBeNull();
  });

  it("ignora puntos no finitos sin romper", () => {
    const withBad = [...GRID_POINTS, { lat: NaN, lng: -71, value: 5 }];
    const surface = buildAnomalySurface(withBad);
    expect(surface?.sourceCount).toBe(4);
  });

  it("normalized queda en [0,1] con min/max reales de las celdas", () => {
    const surface = buildAnomalySurface(GRID_POINTS);
    expect(surface).not.toBeNull();
    for (const cell of surface!.cells) {
      expect(cell.normalized).toBeGreaterThanOrEqual(0);
      expect(cell.normalized).toBeLessThanOrEqual(1);
    }
    const atMin = surface!.cells.find((c) => c.value === surface!.min);
    const atMax = surface!.cells.find((c) => c.value === surface!.max);
    expect(atMin?.normalized).toBeCloseTo(0);
    expect(atMax?.normalized).toBeCloseTo(1);
  });

  it("un punto exacto en una celda del grid devuelve su valor exacto (sin promediar)", () => {
    const surface = buildAnomalySurface(GRID_POINTS, { gridSize: 40 });
    expect(surface).not.toBeNull();
    const near8 = surface!.cells.reduce((best, c) =>
      Math.abs(c.lat - -33.84) + Math.abs(c.lng - -70.99) <
      Math.abs(best.lat - -33.84) + Math.abs(best.lng - -70.99)
        ? c
        : best,
    );
    expect(near8.value).toBeCloseTo(8, 0);
  });

  it("usa la unidad pasada por opciones, default z-score", () => {
    expect(buildAnomalySurface(GRID_POINTS)?.unit).toBe("z-score");
    expect(buildAnomalySurface(GRID_POINTS, { unit: "ppm" })?.unit).toBe("ppm");
  });

  it("es determinista", () => {
    const a = buildAnomalySurface(GRID_POINTS);
    const b = buildAnomalySurface(GRID_POINTS);
    expect(a).toEqual(b);
  });
});

describe("anomalyIntensityColor", () => {
  it("clampea fuera de [0,1]", () => {
    expect(anomalyIntensityColor(-5)).toBe(anomalyIntensityColor(0));
    expect(anomalyIntensityColor(5)).toBe(anomalyIntensityColor(1));
  });

  it("coincide con los stops exactos de ANOMALY_INTENSITY_COLOR_STOPS en sus extremos", () => {
    // rgb(37,66,153) == #254299, rgb(217,70,239) == #d946ef
    expect(anomalyIntensityColor(0)).toBe("rgb(37,66,153)");
    expect(anomalyIntensityColor(1)).toBe("rgb(217,70,239)");
  });

  it("es monótona entre stops consecutivos (más intensidad -> no se oscurece hacia atrás)", () => {
    const low = anomalyIntensityColor(0.1);
    const high = anomalyIntensityColor(0.2);
    expect(low).not.toBe(high);
  });
});

describe("ANOMALY_INTENSITY_COLOR_STOPS", () => {
  it("tiene 5 stops ordenados de 0 a 1, consistentes con anomalyIntensityColor", () => {
    expect(ANOMALY_INTENSITY_COLOR_STOPS).toHaveLength(5);
    expect(ANOMALY_INTENSITY_COLOR_STOPS[0][0]).toBe(0);
    expect(ANOMALY_INTENSITY_COLOR_STOPS.at(-1)?.[0]).toBe(1);
    const ts = ANOMALY_INTENSITY_COLOR_STOPS.map(([t]) => t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
  });
});

describe("anomalySurfaceToFeatureCollection", () => {
  const surface: AnomalySurface = {
    unit: "z-score",
    sourceCount: 4,
    min: 2,
    max: 8,
    cells: [
      {
        lat: -33.845,
        lng: -70.995,
        south: -33.85,
        west: -71.0,
        north: -33.84,
        east: -70.99,
        value: 5,
        normalized: 0.5,
      },
    ],
  };

  it("un feature Polygon por celda, con las 4 esquinas cerradas", () => {
    const fc = anomalySurfaceToFeatureCollection(surface);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    const ring = fc.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]); // anillo cerrado
  });

  it("preserva value/normalized/unit/sourceCount en properties sin mutarlos", () => {
    const fc = anomalySurfaceToFeatureCollection(surface);
    const props = fc.features[0].properties;
    expect(props.value).toBe(5);
    expect(props.normalized).toBe(0.5);
    expect(props.unit).toBe("z-score");
    expect(props.sourceCount).toBe(4);
  });

  it("usa el bbox real de la celda (west/south/east/north), no inventa coordenadas", () => {
    const fc = anomalySurfaceToFeatureCollection(surface);
    const ring = fc.features[0].geometry.coordinates[0];
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    expect(Math.min(...lngs)).toBe(-71.0);
    expect(Math.max(...lngs)).toBe(-70.99);
    expect(Math.min(...lats)).toBe(-33.85);
    expect(Math.max(...lats)).toBe(-33.84);
  });

  it("ids de feature únicos y estables para el mismo input", () => {
    const fc1 = anomalySurfaceToFeatureCollection(surface);
    const fc2 = anomalySurfaceToFeatureCollection(surface);
    expect(fc1.features[0].id).toBe(fc2.features[0].id);
  });
});
