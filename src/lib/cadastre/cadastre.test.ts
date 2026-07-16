import { describe, expect, it } from "vitest";
import { mapChileAttributes, normalizeChileStatus } from "./connectors/chile";
import { mapPeruAttributes, normalizePeruStatus } from "./connectors/peru";
import { mapBrazilAttributes, normalizeBrazilStatus } from "./connectors/brazil";
import {
  mapLandfolioAttributes,
  normalizeLandfolioStatus,
  mergeConcessions,
} from "./connectors/landfolio";
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

describe("normalizeLandfolioStatus", () => {
  it("mapea los StatusGrp de Landfolio al estado canónico", () => {
    expect(normalizeLandfolioStatus("Active")).toBe("active");
    expect(normalizeLandfolioStatus("Application")).toBe("pending");
    expect(normalizeLandfolioStatus("Inactive")).toBe("extinct");
    expect(normalizeLandfolioStatus(null)).toBe("unknown");
  });
});

describe("mapLandfolioAttributes", () => {
  const cfg = {
    country: "ZM" as const,
    institution: "Zambia Mining Cadastre",
    viewerUrl: "https://portals.landfolio.com/zambia/",
  };

  it("construye el esquema canónico desde Landfolio (datos reales de Zambia)", () => {
    const c = mapLandfolioAttributes(
      {
        Code: "7979-HQ-LPL ",
        Name: "",
        Parties: "First Quantum Mining & Operations Limited (100%)",
        TypeGroup: "Exploration",
        Type: "Prospecting Licence",
        StatusGrp: "Inactive",
        Status: "Expired",
        AreaValue: 45712.72,
        AreaUnit: "Hectare",
        Commodities: "Cobalt",
        Region: "Zambia",
        MapRef: "Central, Kapiri Mposhi, Mkushi; Copperbelt, Masaiti",
        DteExpires: 1263513600000,
      },
      cfg,
    );
    expect(c.country).toBe("ZM");
    expect(c.code).toBe("7979-HQ-LPL");
    expect(c.name).toBeNull();
    expect(c.holder).toBe("First Quantum Mining & Operations Limited (100%)");
    expect(c.areaHa).toBe(45712.72);
    expect(c.commodity).toBe("Cobalt");
    expect(c.status).toBe("Inactive · Expired");
    expect(c.statusNormalized).toBe("extinct");
    expect(c.expiresAt).toBe("2010-01-15");
    expect(c.location).toContain("Copperbelt");
    expect(c.source).toBe("Zambia Mining Cadastre (Landfolio)");
  });

  it("convierte km² a hectáreas y tolera fechas nulas", () => {
    const c = mapLandfolioAttributes(
      { Code: "X", AreaValue: 2.5, AreaUnit: "Square Kilometre", DteExpires: null },
      cfg,
    );
    expect(c.areaHa).toBe(250);
    expect(c.expiresAt).toBeNull();
  });
});

describe("mergeConcessions", () => {
  const mk = (code: string) =>
    mapLandfolioAttributes(
      { Code: code, StatusGrp: "Active" },
      {
        country: "MW" as const,
        institution: "Malawi Mining Cadastre",
        viewerUrl: "x",
      },
    );

  it("une capas, deduplica por código y respeta el límite", () => {
    const merged = mergeConcessions(
      [
        [mk("A"), mk("B")],
        [mk("B"), mk("C"), mk("D")],
      ],
      3,
    );
    expect(merged.map((c) => c.code)).toEqual(["A", "B", "C"]);
  });

  it("descarta códigos vacíos", () => {
    expect(mergeConcessions([[mk("")]], 5)).toHaveLength(0);
  });
});

describe("mapLandfolioAttributes · Malawi (datos reales)", () => {
  it("mapea la licencia ML0232 con área en km²", () => {
    const c = mapLandfolioAttributes(
      {
        Code: "ML0232",
        TypeGroup: "Mining",
        Type: "Mining Licence",
        StatusGrp: "Active",
        Status: "Pending Renewal",
        Parties: "Tahit Networks Civil Engineering Contractors",
        AreaValue: 0.585,
        AreaUnit: "Square Kilometre",
        DteExpires: 1817510400000,
      },
      { country: "MW", institution: "Malawi Mining Cadastre", viewerUrl: "x" },
    );
    expect(c.country).toBe("MW");
    expect(c.code).toBe("ML0232");
    expect(c.statusNormalized).toBe("active");
    expect(c.areaHa).toBeCloseTo(58.5, 5);
    expect(c.expiresAt).toBe("2027-08-06");
    expect(c.commodity).toBeNull();
  });
});

describe("registry", () => {
  it("resuelve conectores por país y lista los disponibles", () => {
    expect(getCadastreConnector("CL")?.institution).toBe("SERNAGEOMIN");
    expect(getCadastreConnector("PE")?.institution).toBe("INGEMMET");
    expect(getCadastreConnector("BR")?.institution).toBe("ANM");
    expect(getCadastreConnector("ZM")?.institution).toBe("Zambia Mining Cadastre");
    expect(getCadastreConnector("MW")?.institution).toBe("Malawi Mining Cadastre");
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
