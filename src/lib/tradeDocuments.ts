// Ecosistema documental de una transacción de commodities (comercio exterior +
// trade finance). Define el catálogo de documentos por fase, las etapas del
// pipeline y el cálculo de avance. Lógica pura y testeable; los server fns y la
// UI consumen estas estructuras. NO facilita instrumentos financieros: es
// gestión documental y de estado del deal.

export type TradePhase = "comercial" | "financiero" | "exportacion";

export type TradeStage = "icpo" | "fco" | "spa" | "payment" | "shipping" | "delivered" | "closed";

export const TRADE_STAGES: { key: TradeStage; label: string; phase: TradePhase }[] = [
  { key: "icpo", label: "Intención (ICPO / LOI)", phase: "comercial" },
  { key: "fco", label: "Oferta (FCO)", phase: "comercial" },
  { key: "spa", label: "Contrato (SPA)", phase: "comercial" },
  { key: "payment", label: "Instrumento de pago (SBLC / DLC)", phase: "financiero" },
  { key: "shipping", label: "Embarque y documentos de exportación", phase: "exportacion" },
  { key: "delivered", label: "Entregado", phase: "exportacion" },
  { key: "closed", label: "Cerrado", phase: "exportacion" },
];

export const PHASE_LABEL: Record<TradePhase, string> = {
  comercial: "Comercial",
  financiero: "Financiero",
  exportacion: "Exportación y embarque",
};

export type DocType = {
  key: string;
  label: string;
  acronym?: string;
  phase: TradePhase;
  /** Parte que normalmente lo emite/firma. */
  party: "buyer" | "seller" | "both" | "third_party";
  /** Documento imprescindible para el checklist mínimo. */
  core: boolean;
};

/** Catálogo canónico de documentos del ciclo de comercio de commodities. */
export const DOC_CATALOG: DocType[] = [
  // Comercial
  {
    key: "icpo",
    label: "Orden de compra corporativa irrevocable",
    acronym: "ICPO",
    phase: "comercial",
    party: "buyer",
    core: true,
  },
  {
    key: "loi",
    label: "Carta de intención",
    acronym: "LOI",
    phase: "comercial",
    party: "buyer",
    core: false,
  },
  {
    key: "fco",
    label: "Oferta corporativa completa",
    acronym: "FCO",
    phase: "comercial",
    party: "seller",
    core: true,
  },
  {
    key: "spa",
    label: "Contrato de compraventa",
    acronym: "SPA",
    phase: "comercial",
    party: "both",
    core: true,
  },
  {
    key: "pop",
    label: "Prueba de producto",
    acronym: "POP",
    phase: "comercial",
    party: "seller",
    core: false,
  },
  {
    key: "product_photos",
    label: "Fotografías del producto",
    phase: "comercial",
    party: "seller",
    core: false,
  },
  // Financiero
  {
    key: "sblc_mt760",
    label: "Standby Letter of Credit (SWIFT MT760)",
    acronym: "SBLC",
    phase: "financiero",
    party: "buyer",
    core: true,
  },
  {
    key: "dlc",
    label: "Carta de crédito documentaria",
    acronym: "DLC",
    phase: "financiero",
    party: "buyer",
    core: false,
  },
  {
    key: "proof_of_funds",
    label: "Prueba de fondos",
    acronym: "POF",
    phase: "financiero",
    party: "buyer",
    core: false,
  },
  {
    key: "bank_comfort_letter",
    label: "Bank Comfort Letter",
    acronym: "BCL",
    phase: "financiero",
    party: "buyer",
    core: false,
  },
  // Exportación y embarque
  {
    key: "commercial_invoice",
    label: "Factura comercial",
    phase: "exportacion",
    party: "seller",
    core: true,
  },
  {
    key: "packing_list",
    label: "Lista de empaque",
    phase: "exportacion",
    party: "seller",
    core: true,
  },
  {
    key: "certificate_of_origin",
    label: "Certificado de origen",
    phase: "exportacion",
    party: "third_party",
    core: true,
  },
  {
    key: "sgs_certificate",
    label: "Certificado de inspección SGS",
    acronym: "SGS",
    phase: "exportacion",
    party: "third_party",
    core: true,
  },
  {
    key: "assay_coa",
    label: "Certificado de análisis / ensaye",
    acronym: "CoA",
    phase: "exportacion",
    party: "third_party",
    core: true,
  },
  {
    key: "warehouse_receipt",
    label: "Recibo de almacén (Warehouse Receipt)",
    phase: "exportacion",
    party: "third_party",
    core: false,
  },
  {
    key: "export_authorization",
    label: "Autorización de exportación",
    phase: "exportacion",
    party: "third_party",
    core: true,
  },
  {
    key: "bill_of_lading",
    label: "Conocimiento de embarque (B/L)",
    acronym: "B/L",
    phase: "exportacion",
    party: "third_party",
    core: true,
  },
  {
    key: "insurance_certificate",
    label: "Certificado de seguro",
    phase: "exportacion",
    party: "third_party",
    core: false,
  },
];

export const DOC_BY_KEY: Record<string, DocType> = Object.fromEntries(
  DOC_CATALOG.map((d) => [d.key, d]),
);

export type DocStatus = "pending" | "uploaded" | "signed" | "verified" | "rejected";

/** Un documento se considera "provisto" si está cargado, firmado o verificado. */
export function isDocProvided(status: string): boolean {
  return status === "uploaded" || status === "signed" || status === "verified";
}

export type PhaseProgress = { phase: TradePhase; done: number; total: number; pct: number };

export type TradeProgress = {
  phases: PhaseProgress[];
  overall: { done: number; total: number; pct: number };
  coreDone: number;
  coreTotal: number;
};

/**
 * Avance del checklist a partir de los documentos del trade. Cuenta un tipo como
 * completo si al menos un documento de ese tipo está provisto.
 */
export function tradeProgress(docs: Array<{ doc_type: string; status: string }>): TradeProgress {
  const provided = new Set(docs.filter((d) => isDocProvided(d.status)).map((d) => d.doc_type));
  const phases: TradePhase[] = ["comercial", "financiero", "exportacion"];
  const phaseProgress = phases.map((phase) => {
    const items = DOC_CATALOG.filter((d) => d.phase === phase);
    const done = items.filter((d) => provided.has(d.key)).length;
    const total = items.length;
    return { phase, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  });
  const done = phaseProgress.reduce((a, p) => a + p.done, 0);
  const total = phaseProgress.reduce((a, p) => a + p.total, 0);
  const core = DOC_CATALOG.filter((d) => d.core);
  return {
    phases: phaseProgress,
    overall: { done, total, pct: total ? Math.round((done / total) * 100) : 0 },
    coreDone: core.filter((d) => provided.has(d.key)).length,
    coreTotal: core.length,
  };
}

export function stageIndex(stage: string): number {
  const i = TRADE_STAGES.findIndex((s) => s.key === stage);
  return i < 0 ? 0 : i;
}
