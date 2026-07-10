import { describe, expect, it } from "vitest";
import { buildTradeDoc, isGeneratable, type TradeDocInput } from "./tradeDocGen";

const input: TradeDocInput = {
  reference: "TRD-2026-001",
  commodity: "Cu",
  form: "concentrate",
  quantity_t: 500,
  incoterm: "CIF",
  unit_price_usd: 3200,
  total_value_usd: 1_600_000,
  currency: "USD",
  payment_instrument: "sblc_mt760",
  buyerName: "Global Metals Ltd",
  sellerName: "Minera Los Andes SpA",
  portOfLoading: "Valparaíso",
  destination: "Shanghai",
  date: "2026-07-10",
};

describe("isGeneratable", () => {
  it("acepta documentos comerciales y rechaza los de terceros", () => {
    expect(isGeneratable("icpo")).toBe(true);
    expect(isGeneratable("spa")).toBe(true);
    expect(isGeneratable("commercial_invoice")).toBe(true);
    expect(isGeneratable("sgs_certificate")).toBe(false);
    expect(isGeneratable("bill_of_lading")).toBe(false);
  });
});

describe("buildTradeDoc", () => {
  it("devuelve null para tipos no generables", () => {
    expect(buildTradeDoc("sgs_certificate", input)).toBeNull();
  });

  it("ICPO incluye título, referencia, partes y firma del comprador", () => {
    const doc = buildTradeDoc("icpo", input)!;
    expect(doc.title).toContain("ICPO");
    expect(doc.reference).toBe("TRD-2026-001");
    const sig = doc.blocks.find((b) => b.kind === "signature");
    expect(sig).toMatchObject({ kind: "signature", parties: ["Comprador"] });
    const fields = doc.blocks.find((b) => b.kind === "fields") as { rows: [string, string][] };
    const flat = fields.rows.map((r) => r.join(": ")).join(" | ");
    expect(flat).toContain("Global Metals Ltd");
    expect(flat).toContain("Minera Los Andes SpA");
  });

  it("SPA lleva cláusulas y firma de ambas partes", () => {
    const doc = buildTradeDoc("spa", input)!;
    expect(doc.blocks.some((b) => b.kind === "clauses")).toBe(true);
    const sig = doc.blocks.find((b) => b.kind === "signature");
    expect(sig).toMatchObject({ parties: ["Vendedor", "Comprador"] });
  });

  it("factura comercial trae tabla de importe con el total", () => {
    const doc = buildTradeDoc("commercial_invoice", input)!;
    const table = doc.blocks.find((b) => b.kind === "table") as { rows: string[][] };
    expect(table.rows[0]).toContain("USD 1,600,000");
  });

  it("usa placeholders cuando faltan nombres de las partes", () => {
    const doc = buildTradeDoc("loi", { ...input, buyerName: null, sellerName: null })!;
    const para = doc.blocks.find((b) => b.kind === "paragraph") as { text: string };
    expect(para.text).toContain("[Comprador]");
    expect(para.text).toContain("[Vendedor]");
  });
});
