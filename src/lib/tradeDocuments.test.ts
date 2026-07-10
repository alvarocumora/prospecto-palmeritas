import { describe, expect, it } from "vitest";
import {
  DOC_CATALOG,
  DOC_BY_KEY,
  TRADE_STAGES,
  isDocProvided,
  tradeProgress,
  stageIndex,
} from "./tradeDocuments";

describe("catálogo", () => {
  it("cada documento tiene fase y parte válidas y claves únicas", () => {
    const keys = new Set<string>();
    for (const d of DOC_CATALOG) {
      expect(["comercial", "financiero", "exportacion"]).toContain(d.phase);
      expect(["buyer", "seller", "both", "third_party"]).toContain(d.party);
      expect(keys.has(d.key)).toBe(false);
      keys.add(d.key);
    }
  });
  it("incluye los documentos clave del ecosistema", () => {
    for (const k of [
      "icpo",
      "loi",
      "fco",
      "spa",
      "sblc_mt760",
      "dlc",
      "commercial_invoice",
      "packing_list",
      "certificate_of_origin",
      "sgs_certificate",
      "warehouse_receipt",
      "export_authorization",
      "bill_of_lading",
      "product_photos",
    ]) {
      expect(DOC_BY_KEY[k]).toBeTruthy();
    }
  });
});

describe("isDocProvided", () => {
  it("cuenta cargado/firmado/verificado, no pendiente/rechazado", () => {
    expect(isDocProvided("uploaded")).toBe(true);
    expect(isDocProvided("signed")).toBe(true);
    expect(isDocProvided("verified")).toBe(true);
    expect(isDocProvided("pending")).toBe(false);
    expect(isDocProvided("rejected")).toBe(false);
  });
});

describe("tradeProgress", () => {
  it("trade sin documentos → 0%", () => {
    const p = tradeProgress([]);
    expect(p.overall.pct).toBe(0);
    expect(p.overall.total).toBe(DOC_CATALOG.length);
    expect(p.coreDone).toBe(0);
  });

  it("cuenta un tipo como completo con un doc provisto y agrupa por fase", () => {
    const p = tradeProgress([
      { doc_type: "icpo", status: "signed" },
      { doc_type: "fco", status: "uploaded" },
      { doc_type: "spa", status: "pending" }, // no cuenta
      { doc_type: "sblc_mt760", status: "verified" },
    ]);
    const comercial = p.phases.find((x) => x.phase === "comercial")!;
    const financiero = p.phases.find((x) => x.phase === "financiero")!;
    expect(comercial.done).toBe(2); // icpo + fco
    expect(financiero.done).toBe(1); // sblc
    expect(p.overall.done).toBe(3);
    expect(p.coreDone).toBeGreaterThanOrEqual(3);
  });

  it("no duplica si hay dos docs del mismo tipo", () => {
    const p = tradeProgress([
      { doc_type: "product_photos", status: "uploaded" },
      { doc_type: "product_photos", status: "verified" },
    ]);
    const comercial = p.phases.find((x) => x.phase === "comercial")!;
    expect(comercial.done).toBe(1);
  });
});

describe("stageIndex", () => {
  it("devuelve el orden del pipeline", () => {
    expect(stageIndex("icpo")).toBe(0);
    expect(stageIndex("closed")).toBe(TRADE_STAGES.length - 1);
    expect(stageIndex("desconocido")).toBe(0);
  });
});
