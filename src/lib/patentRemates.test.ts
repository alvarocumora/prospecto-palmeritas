import { describe, expect, it } from "vitest";
import { parseRemateRows, normalizeConcessionCode } from "./patentRemates";

describe("normalizeConcessionCode", () => {
  it("combina rol y dv en 'rol-dv'", () => {
    expect(normalizeConcessionCode("63010070", "4")).toBe("63010070-4");
  });
  it("acepta dv 'K'", () => {
    expect(normalizeConcessionCode("12345678", "K")).toBe("12345678-K");
  });
  it("sin dv devuelve solo el rol", () => {
    expect(normalizeConcessionCode("63010070", null)).toBe("63010070");
  });
  it("rol vacío devuelve null", () => {
    expect(normalizeConcessionCode(null, "4")).toBeNull();
    expect(normalizeConcessionCode("--", "4")).toBeNull();
  });
});

describe("parseRemateRows", () => {
  it("normaliza una fila típica de la nómina (cabeceras con acentos/espacios)", () => {
    const [row] = parseRemateRows(
      [
        {
          "N° ROL": "63010070",
          DV: "4",
          "Nombre Concesión": "ESTHERCITA 1/6",
          Titular: "Minera Los Andes SpA",
          RUT: "76.123.456-7",
          Región: "O'Higgins",
          Comuna: "Pichilemu",
          "Tipo Concesión": "Explotación",
          "Años Adeudados": "3",
          "Valor Adeudado": "$1.250.000",
          Tribunal: "1° Juzgado de Letras de Santa Cruz",
          "Rol Causa": "C-123-2026",
        },
      ],
      { year: 2026, sourceUrl: "https://sernageomin.cl/nomina.pdf" },
    );
    expect(row.concession_code).toBe("63010070-4");
    expect(row.concession_name).toBe("ESTHERCITA 1/6");
    expect(row.holder_name).toBe("Minera Los Andes SpA");
    expect(row.holder_rut).toBe("76.123.456-7");
    expect(row.region).toBe("O'Higgins");
    expect(row.comuna).toBe("Pichilemu");
    expect(row.concession_type).toBe("explotacion");
    expect(row.years_owed).toBe(3);
    expect(row.amount_clp).toBe(1250000);
    expect(row.court).toBe("1° Juzgado de Letras de Santa Cruz");
    expect(row.court_role).toBe("C-123-2026");
    expect(row.status).toBe("nomina");
    expect(row.source).toBe("sernageomin-amparo");
    expect(row.source_url).toBe("https://sernageomin.cl/nomina.pdf");
    expect(row.content_hash).toMatch(/^[0-9a-f]+$/);
  });

  it("separa un rol combinado 'rol-dv'", () => {
    const [row] = parseRemateRows([{ ROL: "63010070-4", NOMBRE: "X" }], { year: 2026 });
    expect(row.rol).toBe("63010070");
    expect(row.dv_rol).toBe("4");
    expect(row.concession_code).toBe("63010070-4");
  });

  it("descarta filas sin rol ni nombre (encabezados, totales)", () => {
    const rows = parseRemateRows(
      [
        { TOTAL: "999", "": "" },
        { ROL: "111", NOMBRE: "Válida" },
      ],
      { year: 2026 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].concession_name).toBe("Válida");
  });

  it("hash estable entre corridas para la misma concesión/año/causa", () => {
    const opts = { year: 2026 };
    const a = parseRemateRows([{ ROL: "111", DV: "2", "Rol Causa": "C-9-2026" }], opts);
    const b = parseRemateRows([{ ROL: "111", DV: "2", "Rol Causa": "C-9-2026" }], opts);
    expect(a[0].content_hash).toBe(b[0].content_hash);
  });

  it("distingue por año (evento distinto en otra nómina)", () => {
    const a = parseRemateRows([{ ROL: "111", DV: "2" }], { year: 2025 });
    const b = parseRemateRows([{ ROL: "111", DV: "2" }], { year: 2026 });
    expect(a[0].content_hash).not.toBe(b[0].content_hash);
  });
});
