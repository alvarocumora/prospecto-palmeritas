import { describe, expect, it } from "vitest";
import {
  propsToRow,
  featuresToCSV,
  featuresToGeoJSON,
  type ConcesionFeature,
} from "./catastroExport";

const feat = (props: Record<string, unknown>, geometry: unknown = null): ConcesionFeature => ({
  type: "Feature",
  geometry,
  properties: props,
});

describe("propsToRow", () => {
  it("arma rol y rut con dígito verificador", () => {
    const r = propsToRow({
      NUMERO_ROL: "63010070",
      DV_ROL: "4",
      TITULAR_RUT: "76123456",
      TITULAR_DV: "7",
      NOMBRE: "ESTHERCITA",
      TITULAR_NOMBRE: "Minera X",
      COMUNA: "Pichilemu",
      HECTAREAS: 100,
      TIPO_CONCESION: "EXPLOTACION",
      SITUACION_CONCESION: "CONSTITUIDA",
    });
    expect(r.ROL).toBe("63010070-4");
    expect(r.RUT).toBe("76123456-7");
    expect(r.NOMBRE).toBe("ESTHERCITA");
    expect(r.HECTAREAS).toBe("100");
  });
  it("campos faltantes quedan vacíos", () => {
    const r = propsToRow({});
    expect(r.ROL).toBe("");
    expect(r.RUT).toBe("");
    expect(r.TITULAR).toBe("");
  });
});

describe("featuresToCSV", () => {
  it("incluye header y una fila por feature", () => {
    const csv = featuresToCSV([
      feat({ NUMERO_ROL: "1", DV_ROL: "2", NOMBRE: "A" }),
      feat({ NUMERO_ROL: "3", DV_ROL: "4", NOMBRE: "B" }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("ROL,NOMBRE,TITULAR,RUT,COMUNA,REGION,HECTAREAS,TIPO,SITUACION");
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("1-2,A,")).toBe(true);
  });
  it("escapa valores con comas", () => {
    const csv = featuresToCSV([feat({ NUMERO_ROL: "1", NOMBRE: "MINA, SUR" })]);
    expect(csv).toContain('"MINA, SUR"');
  });
});

describe("featuresToGeoJSON", () => {
  it("produce un FeatureCollection válido con geometría", () => {
    const geo = JSON.parse(
      featuresToGeoJSON([feat({ NOMBRE: "A" }, { type: "Point", coordinates: [1, 2] })]),
    );
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features).toHaveLength(1);
    expect(geo.features[0].geometry).toEqual({ type: "Point", coordinates: [1, 2] });
    expect(geo.features[0].properties.NOMBRE).toBe("A");
  });
});
