import { describe, expect, it } from "vitest";
import { buildTermSheet, termSheetToMarkdown, type TermSheetInput } from "./termSheet";

function input(over: Partial<TermSheetInput> = {}): TermSheetInput {
  return {
    ref: "TS-2026-001",
    sellerName: "Minera Los Andes SpA",
    buyerName: "Trader Global Ltd",
    lotTitle: "Concentrado Cu 28% — Región de Coquimbo",
    commodityLabel: "Concentrado de cobre",
    formLabel: "Concentrado",
    gradePct: 28,
    moisturePct: 8,
    deleterious: { AS: 0.5 },
    tonnageT: 500,
    targetVolumeT: 200,
    incoterm: "FOB",
    portOfLoading: "Coquimbo",
    country: "CL",
    priceBasis: null,
    premiumDiscountUsdT: -30,
    paymentTerms: null,
    netUsdT: 2294,
    band: { low: 2065, high: 2524 },
    ...over,
  };
}

describe("buildTermSheet", () => {
  it("arma todas las secciones con los datos del lote y la consulta", () => {
    const ts = buildTermSheet(input());
    const headings = ts.sections.map((s) => s.heading);
    expect(headings).toEqual([
      "1. Partes",
      "2. Producto y calidad",
      "3. Cantidad",
      "4. Precio y fórmula",
      "5. Entrega",
      "6. Pago",
    ]);
    const cantidad = ts.sections.find((s) => s.heading === "3. Cantidad");
    // usa el volumen objetivo de la consulta (200), no la disponibilidad (500)
    expect(cantidad?.fields[0].value).toBe("200 t");
    const precio = ts.sections.find((s) => s.heading === "4. Precio y fórmula");
    expect(precio?.fields.some((f) => f.value.includes("2,294"))).toBe(true);
  });

  it("cae a defaults sensatos cuando faltan datos", () => {
    const ts = buildTermSheet(
      input({ priceBasis: null, paymentTerms: null, incoterm: null, deleterious: {} }),
    );
    const entrega = ts.sections.find((s) => s.heading === "5. Entrega");
    expect(entrega?.fields[0].value).toBe("Por acordar");
    const calidad = ts.sections.find((s) => s.heading === "2. Producto y calidad");
    expect(calidad?.fields.some((f) => f.value === "Según certificado de ensaye")).toBe(true);
  });

  it("respeta price_basis y payment_terms explícitos", () => {
    const ts = buildTermSheet(
      input({ priceBasis: "LME M+1 promedio", paymentTerms: "LC a la vista" }),
    );
    const precio = ts.sections.find((s) => s.heading === "4. Precio y fórmula");
    expect(precio?.fields[0].value).toBe("LME M+1 promedio");
  });
});

describe("termSheetToMarkdown", () => {
  it("serializa a Markdown con título, referencia y secciones", () => {
    const md = termSheetToMarkdown(buildTermSheet(input()));
    expect(md).toContain("# Term Sheet — Concentrado Cu 28%");
    expect(md).toContain("**Referencia:** TS-2026-001");
    expect(md).toContain("## 1. Partes");
    expect(md).toContain("- **Vendedor:** Minera Los Andes SpA");
    expect(md).toContain("> Borrador referencial no vinculante");
  });
});
