import { describe, expect, it } from "vitest";
import { TEMPLATE_BY_ID, TEMPLATES } from "./templates";
import { mapLotToDataSheetValues, type LotForDataSheet } from "./prefill";

const LOT: LotForDataSheet = {
  title: "Concentrado de cobre — Lote Norte",
  commodity: "cu_concentrate",
  form: "concentrate",
  grade_pct: 24.5,
  moisture_pct: 8,
  tonnage_available_t: 1000,
  lot_size_t: 100,
  frequency: "monthly",
  country: "CL",
  region: "Coquimbo",
  port_of_loading: "Puerto de Coquimbo",
  incoterm: "FOB",
  price_basis: "LME M+1",
  payment_terms: "90/10",
  certifications_json: ["SGS", "ISO 9001"],
  deleterious_json: { As: "0.18%", Sb: "0.05%" },
};

describe("template data-sheet", () => {
  const tpl = TEMPLATE_BY_ID["data-sheet"];

  it("está registrado en el catálogo con categoría trade", () => {
    expect(tpl).toBeDefined();
    expect(tpl.category).toBe("trade");
    expect(TEMPLATES.some((t) => t.id === "data-sheet")).toBe(true);
  });

  it("build() genera las tablas de especificación y las cláusulas activas", () => {
    const values = {
      seller: "Minera Norte SpA",
      product: "Concentrado de cobre",
      grade: "24,5 % Cu",
      tonnage: "1000",
      kymScore: "82",
    };
    const doc = tpl.build(values, new Set(["confidential", "notOffer"]), {
      reference: "GC-DS-1",
      date: "2026-07-17",
    });
    expect(doc.title).toBe("COMMODITY DATA SHEET");
    const tables = doc.blocks.filter((b) => b.kind === "table");
    expect(tables).toHaveLength(2);
    const fields = doc.blocks.find((b) => b.kind === "fields");
    expect(fields && "rows" in fields ? fields.rows : []).toContainEqual([
      "Verificación KYM",
      "82 / 100 (Geocapitals)",
    ]);
    const clauses = doc.blocks.find((b) => b.kind === "clauses");
    expect(clauses && "items" in clauses ? clauses.items : []).toHaveLength(2);
  });

  it("sin kymScore no agrega la fila de verificación", () => {
    const doc = tpl.build({ seller: "X" }, new Set(), { reference: "r", date: "d" });
    const fields = doc.blocks.find((b) => b.kind === "fields");
    const rows = fields && "rows" in fields ? fields.rows : [];
    expect(rows.some(([k]) => k === "Verificación KYM")).toBe(false);
  });
});

describe("mapLotToDataSheetValues", () => {
  it("mapea el lote real a los valores del formulario", () => {
    const v = mapLotToDataSheetValues(LOT, { sellerName: "Minera Norte SpA", kymScore: 82 });
    expect(v.lotTitle).toBe("Concentrado de cobre — Lote Norte");
    expect(v.grade).toBe("24.5 %");
    expect(v.moisture).toBe("8");
    expect(v.tonnage).toBe("1000");
    expect(v.origin).toContain("Coquimbo");
    expect(v.incoterm).toBe("FOB");
    expect(v.certifications).toBe("SGS, ISO 9001");
    expect(v.deleterious).toContain("As");
    expect(v.seller).toBe("Minera Norte SpA");
    expect(v.kymScore).toBe("82");
  });

  it("deja vacío lo que la fuente no publica y omite seller/kym si no vienen", () => {
    const v = mapLotToDataSheetValues({
      ...LOT,
      grade_pct: null,
      port_of_loading: null,
      certifications_json: null,
      deleterious_json: null,
    });
    expect(v.grade).toBe("");
    expect(v.port).toBe("");
    expect(v.certifications).toBe("");
    expect(v.deleterious).toBe("");
    expect(v.seller).toBeUndefined();
    expect(v.kymScore).toBeUndefined();
  });

  it("el prefill alimenta build() de punta a punta", () => {
    const tpl = TEMPLATE_BY_ID["data-sheet"];
    const values = mapLotToDataSheetValues(LOT, { kymScore: 75 });
    const doc = tpl.build(values, new Set(["kymNote"]), { reference: "r", date: "d" });
    const spec = doc.blocks.find((b) => b.kind === "table");
    const rows = spec && "rows" in spec ? spec.rows : [];
    expect(rows).toContainEqual(["Humedad", "8 %"]);
    expect(rows.some((r) => r[1].includes("As"))).toBe(true);
  });
});
