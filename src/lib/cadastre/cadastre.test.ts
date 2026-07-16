import { describe, expect, it } from "vitest";
import { mapChileAttributes, normalizeChileStatus } from "./connectors/chile";
import { mapPeruAttributes, normalizePeruStatus } from "./connectors/peru";
import { mapBrazilAttributes, normalizeBrazilStatus } from "./connectors/brazil";
import { getCadastreConnector, listCadastreCountries } from "./registry";
import { sanitizeArcgisTerm } from "./arcgis";

describe("normalizeChileStatus", () => {
  it("mapea las situaciones de SERNAGEOMIN al estado canónico", () => {
    expect(normalizeChileStatus("CONSTITUIDA")).toBe("active");
    expect(normalizeChileStatus("EN TRAMITE")).toBe("pending");
    expect(normalizeChileStatus("EN TRÁMITE")).toBe("pending");
    expect(normalizeChileStatus("ELIMINADA")).toBe("extinct");
    expect(normalizeChileStatus(null)).toBe("unknown");
  });
});

describe("normalizePeruStatus", () => {
  it("mapea los D_ESTADO de GEOCATMIN al estado canónico", () => {
    expect(normalizePeruStatus("D.M. Titulado D.L. 708")).toBe("active");
    expect(normalizePeruStatus("D.M. en Trámite D.L. 708")).toBe("pending");
    expect(normalizePeruStatus("D.M. Extinguido")).toBe("extinct");
    expect(normalizePeruStatus("Cantera Afectada al Estado")).toBe("unknown");
    expect(normalizePeruStatus(null)).toBe("unknown");
  });
});

describe("mapChileAttributes", () => {
  it("construye el esquema canónico desde Marcelo_Layer/2", () => {
    const c = mapChileAttributes({
      NUMERO_ROL: "06301007",
      DV_ROL: "4",
      NOMBRE: "ESTHERCITA 1/6",
      TITULAR_NOMBRE: "MINERA X",
      TITULAR_RUT: "006134871",
      TITULAR_DV: "9",
      HECTAREAS: 300,
      SITUACION_CONCESION: "EN TRAMITE",
      TIPO_CONCESION: "EXPLORACION",
      COMUNA: "PICHILEMU",
    });
    expect(c.country).toBe("CL");
    expect(c.code).toBe("06301007-4");
    expect(c.holderTaxId).toBe("006134871-9");
    expect(c.areaHa).toBe(300);
    expect(c.statusNormalized).toBe("pending");
    expect(c.location).toBe("PICHILEMU");
    expect(c.source).toBe("SERNAGEOMIN");
  });

  it("tolera campos ausentes", () => {
    const c = mapChileAttributes({ NOMBRE: "SIN ROL" });
    expect(c.code).toBe("SIN ROL");
    expect(c.holder).toBeNull();
    expect(c.statusNormalized).toBe("unknown");
  });
});

describe("mapPeruAttributes", () => {
  it("construye el esquema canónico desde GEOCATMIN (datos reales verificados)", () => {
    const c = mapPeruAttributes({
      CODIGOU: "010462025",
      CONCESION: "YUM 2501",
      TIT_CONCES: "COMPAÑIA DE MINAS BUENAVENTURA S.A.A.",
      HECTAGIS: 500.0,
      D_ESTADO: "D.M. en Trámite D.L. 708",
      ZONA: "18",
    });
    expect(c.country).toBe("PE");
    expect(c.code).toBe("010462025");
    expect(c.name).toBe("YUM 2501");
    expect(c.holder).toBe("COMPAÑIA DE MINAS BUENAVENTURA S.A.A.");
    expect(c.areaHa).toBe(500);
    expect(c.statusNormalized).toBe("pending");
    expect(c.location).toBe("Zona UTM 18");
    expect(c.source).toBe("INGEMMET GEOCATMIN");
    expect(c.holderTaxId).toBeNull();
  });
});

describe("normalizeBrazilStatus", () => {
  it("mapea las FASE de la ANM al estado canónico", () => {
    expect(normalizeBrazilStatus("CONCESSÃO DE LAVRA")).toBe("active");
    expect(normalizeBrazilStatus("AUTORIZAÇÃO DE PESQUISA")).toBe("active");
    expect(normalizeBrazilStatus("LICENCIAMENTO")).toBe("active");
    expect(normalizeBrazilStatus("REQUERIMENTO DE PESQUISA")).toBe("pending");
    expect(normalizeBrazilStatus("REQUERIMENTO DE LAVRA")).toBe("pending");
    expect(normalizeBrazilStatus("DISPONIBILIDADE")).toBe("pending");
    expect(normalizeBrazilStatus(null)).toBe("unknown");
  });
});

describe("mapBrazilAttributes", () => {
  it("construye el esquema canónico desde SIGMINE (datos reales verificados)", () => {
    const c = mapBrazilAttributes({
      PROCESSO: "3457/1937",
      FASE: "CONCESSÃO DE LAVRA",
      NOME: "VALE S.A.",
      SUBS: "MANGANÊS",
      USO: "Demais substâncias",
      AREA_HA: 469.06,
      UF: "MG",
    });
    expect(c.country).toBe("BR");
    expect(c.code).toBe("3457/1937");
    expect(c.name).toBeNull();
    expect(c.holder).toBe("VALE S.A.");
    expect(c.commodity).toBe("MANGANÊS");
    expect(c.areaHa).toBe(469.06);
    expect(c.statusNormalized).toBe("active");
    expect(c.location).toBe("MG");
    expect(c.source).toBe("ANM SIGMINE");
  });
});

describe("registry", () => {
  it("resuelve conectores por país y lista los disponibles", () => {
    expect(getCadastreConnector("CL")?.institution).toBe("SERNAGEOMIN");
    expect(getCadastreConnector("PE")?.institution).toBe("INGEMMET");
    expect(getCadastreConnector("BR")?.institution).toBe("ANM");
    expect(getCadastreConnector("XX")).toBeNull();
    const countries = listCadastreCountries().map((c) => c.country);
    expect(countries).toContain("CL");
    expect(countries).toContain("PE");
  });
});

describe("sanitizeArcgisTerm", () => {
  it("acepta términos normales (letras, números, espacios, guiones)", () => {
    expect(sanitizeArcgisTerm("BUENAVENTURA")).toBe("BUENAVENTURA");
    expect(sanitizeArcgisTerm(" YUM 2501 ")).toBe("YUM 2501");
  });
  it("rechaza vacío, comillas e inyecciones (whitelist estricta)", () => {
    expect(sanitizeArcgisTerm("")).toBeNull();
    expect(sanitizeArcgisTerm("O'Higgins")).toBeNull();
    expect(sanitizeArcgisTerm("x; DROP TABLE--")).toBeNull();
    expect(sanitizeArcgisTerm("a".repeat(80))).toBeNull();
  });
});
