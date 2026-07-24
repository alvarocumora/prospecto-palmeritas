import { describe, it, expect } from "vitest";
import {
  psad56Band,
  husoFromLon,
  utmToWgs84,
  wgs84ToUtm,
  psad56GeoToWgs84,
  formatDms,
} from "./datum";
import controlPoints from "./control-points.json";

// Distancia aproximada en metros entre dos WGS84 (equirectangular, suficiente
// para tolerancias de metros en esta latitud).
function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6378137;
  const latm = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * (Math.PI / 180) * R * Math.cos(latm);
  const dy = (b[1] - a[1]) * (Math.PI / 180) * R;
  return Math.hypot(dx, dy);
}

describe("datum · franjas PSAD56→WGS84 (§4)", () => {
  it("elige la franja EPSG correcta por latitud", () => {
    expect(psad56Band(-20).code).toBe(6971); // norte de 26°S
    expect(psad56Band(-30).code).toBe(6972); // 26–36°S
    expect(psad56Band(-40).code).toBe(6973); // 36–43.5°S
  });
  it("usa los parámetros de traslación verificados en epsg.io", () => {
    expect(psad56Band(-20).towgs84).toEqual([-302, 272, -360]);
    expect(psad56Band(-30).towgs84).toEqual([-328, 340, -329]);
    expect(psad56Band(-40).towgs84).toEqual([-352, 403, -287]);
  });
});

describe("datum · detección de huso", () => {
  it("18S al oeste de 72°W, 19S al este", () => {
    expect(husoFromLon(-73)).toBe(18);
    expect(husoFromLon(-72.5)).toBe(18);
    expect(husoFromLon(-70)).toBe(19);
  });
});

describe("datum · punto de control de proyección (PMD, autoritativo)", () => {
  it("PSAD56 geográfico → PSAD56 UTM 18S coincide con la lectura oficial (<1 m)", () => {
    const cp = controlPoints.projection[0];
    // geo PSAD56 → WGS84 (aplica el shift de la franja) → UTM PSAD56 (aplica el
    // shift inverso de la MISMA franja): los shifts se cancelan y queda la
    // proyección pura sobre el elipsoide Internacional 1924. Debe reproducir la
    // lectura oficial de PMD.
    const wgs = psad56GeoToWgs84([cp.geo.lon, cp.geo.lat]);
    const utm = wgs84ToUtm(wgs, "PSAD56", cp.huso as 18 | 19);
    expect(utm.huso).toBe(cp.huso);
    expect(Math.abs(utm.e - cp.utm.e)).toBeLessThan(cp.tol_m);
    expect(Math.abs(utm.n - cp.utm.n)).toBeLessThan(cp.tol_m);
  });
});

describe("datum · round-trip WGS84↔PSAD56 UTM", () => {
  const samples: [number, number][] = [
    [-70.3, -23.65], // Antofagasta (norte, franja 6971)
    [-71.6, -33.05], // Valparaíso (central, franja 6972)
    [-72.43, -37.75], // Biobío (sur, franja 6973)
  ];
  it("ida y vuelta conserva la coordenada a <0.5 m", () => {
    for (const p of samples) {
      const utm = wgs84ToUtm(p, "PSAD56");
      const back = utmToWgs84(utm, "PSAD56");
      expect(metersBetween(p, back)).toBeLessThan(0.5);
    }
  });
  it("WGS84 y SIRGAS round-trip también convergen", () => {
    for (const p of samples) {
      for (const d of ["WGS84", "SIRGAS"] as const) {
        const back = utmToWgs84(wgs84ToUtm(p, d), d);
        expect(metersBetween(p, back)).toBeLessThan(0.5);
      }
    }
  });
});

describe("datum · magnitud del corrimiento PSAD56↔WGS84 (§4, ~200 m)", () => {
  it("el shift es del orden de 100–450 m — se aplica, no es cero ni km", () => {
    // El mismo lon/lat interpretado en PSAD56 vs WGS84 debe diferir ~cientos de m.
    const psadGeo: [number, number] = [-72.43, -37.75];
    const wgs = psad56GeoToWgs84(psadGeo);
    const shift = metersBetween(psadGeo, wgs);
    expect(shift).toBeGreaterThan(80);
    expect(shift).toBeLessThan(500);
  });
});

describe("datum · puntos de control de cambio de datum (gate §4)", () => {
  const datumPts = controlPoints.datum as Array<{
    id: string;
    psad56_utm: { e: number; n: number; huso: 18 | 19 };
    wgs84_geo: { lon: number; lat: number };
    tol_m: number;
  }>;
  if (datumPts.length === 0) {
    // Gate declarado PENDIENTE: no se inventan puntos. Ver docs/tenencia/fuentes.md.
    it.todo("cargar >=10 puntos de control PSAD56↔WGS84 de fuente autoritativa (IGM)");
  } else {
    it("cada punto PSAD56→WGS84 cae dentro de tolerancia", () => {
      for (const cp of datumPts) {
        const got = utmToWgs84(cp.psad56_utm, "PSAD56");
        expect(metersBetween([cp.wgs84_geo.lon, cp.wgs84_geo.lat], got)).toBeLessThan(cp.tol_m);
      }
    });
  }
});

describe("datum · formato DMS", () => {
  it("formatea hemisferios S/W de Chile", () => {
    const s = formatDms([-72.4278028, -37.7497611]);
    expect(s).toMatch(/^S37°44'/);
    expect(s).toContain("W72°25'");
  });
});
