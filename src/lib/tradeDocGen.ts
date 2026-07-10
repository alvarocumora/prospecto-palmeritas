// Generador de documentos comerciales del trade (ICPO, LOI, FCO, SPA, factura,
// packing list). Construye un modelo estructurado a partir de los datos del
// trade — lógica pura y testeable. El render a PDF vive en tradeDocPdf.ts.
// Los documentos de terceros (SGS, B/L, certificado de origen, autorización de
// exportación) NO se generan aquí: provienen de emisores externos.

export type DocBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; rows: Array<[string, string]> }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "clauses"; items: string[] }
  | { kind: "signature"; parties: string[] };

export type GeneratedDoc = {
  docType: string;
  title: string;
  reference: string;
  date: string;
  blocks: DocBlock[];
};

export type TradeDocInput = {
  reference: string | null;
  commodity: string | null;
  form: string | null;
  quantity_t: number | null;
  incoterm: string | null;
  unit_price_usd: number | null;
  total_value_usd: number | null;
  currency: string;
  payment_instrument: string | null;
  buyerName?: string | null;
  sellerName?: string | null;
  portOfLoading?: string | null;
  destination?: string | null;
  /** Fecha ISO inyectada (las funciones puras no usan Date.now). */
  date: string;
};

/** Tipos de documento que esta herramienta puede autogenerar. */
export const GENERATABLE = new Set([
  "icpo",
  "loi",
  "fco",
  "spa",
  "commercial_invoice",
  "packing_list",
]);

export function isGeneratable(docType: string): boolean {
  return GENERATABLE.has(docType);
}

const PAYMENT_LABEL: Record<string, string> = {
  sblc_mt760: "SBLC vía SWIFT MT760",
  dlc: "Carta de crédito documentaria (DLC)",
  tt: "Transferencia bancaria (TT)",
  escrow: "Depósito en garantía (escrow)",
};

function money(n: number | null | undefined, ccy: string): string {
  if (n == null) return "—";
  return `${ccy} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function qty(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toLocaleString("en-US")} t`;
}

function commonFields(i: TradeDocInput): Array<[string, string]> {
  return [
    ["Producto", [i.commodity, i.form].filter(Boolean).join(" · ") || "—"],
    ["Cantidad", qty(i.quantity_t)],
    ["Incoterm", i.incoterm ?? "—"],
    ["Precio unitario", `${money(i.unit_price_usd, i.currency)} / t`],
    ["Valor total", money(i.total_value_usd, i.currency)],
    [
      "Instrumento de pago",
      i.payment_instrument ? (PAYMENT_LABEL[i.payment_instrument] ?? i.payment_instrument) : "—",
    ],
  ];
}

const buyer = (i: TradeDocInput) => i.buyerName || "[Comprador]";
const seller = (i: TradeDocInput) => i.sellerName || "[Vendedor]";

/** Construye el modelo del documento, o null si el tipo no es autogenerable. */
export function buildTradeDoc(docType: string, i: TradeDocInput): GeneratedDoc | null {
  if (!isGeneratable(docType)) return null;
  const reference = i.reference || "S/N";
  const base = { docType, reference, date: i.date };

  switch (docType) {
    case "icpo":
      return {
        ...base,
        title: "IRREVOCABLE CORPORATE PURCHASE ORDER (ICPO)",
        blocks: [
          {
            kind: "paragraph",
            text: `${buyer(i)} (el "Comprador") emite de forma irrevocable la presente orden de compra a ${seller(i)} (el "Vendedor") por el producto y condiciones detalladas a continuación.`,
          },
          {
            kind: "fields",
            rows: [["Comprador", buyer(i)], ["Vendedor", seller(i)], ...commonFields(i)],
          },
          {
            kind: "paragraph",
            text: "El Comprador confirma capacidad financiera para ejecutar la operación bajo el instrumento de pago indicado, sujeto a la firma del SPA y a la verificación documental.",
          },
          { kind: "signature", parties: ["Comprador"] },
        ],
      };

    case "loi":
      return {
        ...base,
        title: "LETTER OF INTENT (LOI)",
        blocks: [
          {
            kind: "paragraph",
            text: `${buyer(i)} manifiesta su intención de compra a ${seller(i)} respecto del producto indicado. Esta carta expresa interés comercial y no constituye obligación vinculante hasta la firma del contrato definitivo (SPA).`,
          },
          { kind: "fields", rows: commonFields(i) },
          { kind: "signature", parties: ["Comprador"] },
        ],
      };

    case "fco":
      return {
        ...base,
        title: "FULL CORPORATE OFFER (FCO)",
        blocks: [
          {
            kind: "paragraph",
            text: `${seller(i)} (el "Vendedor") ofrece formalmente a ${buyer(i)} (el "Comprador") el suministro del producto en las condiciones siguientes.`,
          },
          { kind: "fields", rows: commonFields(i) },
          {
            kind: "clauses",
            items: [
              "Origen y calidad certificados por inspección independiente (SGS) previa al embarque.",
              "El pago se instrumenta según lo indicado, contra presentación de documentos de embarque.",
              "Oferta sujeta a disponibilidad y a la firma del SPA dentro de su plazo de validez.",
            ],
          },
          { kind: "signature", parties: ["Vendedor"] },
        ],
      };

    case "spa":
      return {
        ...base,
        title: "SALES AND PURCHASE AGREEMENT (SPA)",
        blocks: [
          {
            kind: "paragraph",
            text: `Contrato de compraventa celebrado entre ${seller(i)} (el "Vendedor") y ${buyer(i)} (el "Comprador") sobre el producto y bajo las condiciones que se detallan.`,
          },
          { kind: "fields", rows: commonFields(i) },
          {
            kind: "clauses",
            items: [
              "1. Objeto: compraventa del producto en la cantidad y calidad especificadas.",
              "2. Precio y pago: según el instrumento indicado; el pago procede contra documentos conformes.",
              "3. Entrega: bajo el Incoterm pactado; riesgos y costos se transfieren conforme a dicho término.",
              "4. Inspección: calidad y peso determinados por inspector independiente (SGS) en el puerto de carga.",
              "5. Documentos: factura comercial, packing list, certificado de origen, certificado SGS y B/L.",
              "6. Ley y arbitraje: a acordar por las partes; disputas resueltas por arbitraje.",
            ],
          },
          { kind: "signature", parties: ["Vendedor", "Comprador"] },
        ],
      };

    case "commercial_invoice":
      return {
        ...base,
        title: "COMMERCIAL INVOICE",
        blocks: [
          {
            kind: "fields",
            rows: [
              ["Vendedor", seller(i)],
              ["Comprador", buyer(i)],
              ["Incoterm", i.incoterm ?? "—"],
              ["Puerto de carga", i.portOfLoading ?? "—"],
              ["Destino", i.destination ?? "—"],
            ],
          },
          {
            kind: "table",
            head: ["Descripción", "Cantidad (t)", "Precio unitario", "Importe"],
            rows: [
              [
                [i.commodity, i.form].filter(Boolean).join(" · ") || "Producto",
                i.quantity_t != null ? i.quantity_t.toLocaleString("en-US") : "—",
                money(i.unit_price_usd, i.currency),
                money(i.total_value_usd, i.currency),
              ],
            ],
          },
          {
            kind: "fields",
            rows: [
              ["Total a pagar", money(i.total_value_usd, i.currency)],
              [
                "Condición de pago",
                i.payment_instrument
                  ? (PAYMENT_LABEL[i.payment_instrument] ?? i.payment_instrument)
                  : "—",
              ],
            ],
          },
          { kind: "signature", parties: ["Vendedor"] },
        ],
      };

    case "packing_list":
      return {
        ...base,
        title: "PACKING LIST",
        blocks: [
          {
            kind: "fields",
            rows: [
              ["Vendedor", seller(i)],
              ["Comprador", buyer(i)],
              ["Puerto de carga", i.portOfLoading ?? "—"],
              ["Destino", i.destination ?? "—"],
            ],
          },
          {
            kind: "table",
            head: ["Ítem", "Descripción", "Peso neto (t)", "Peso bruto (t)"],
            rows: [
              [
                "1",
                [i.commodity, i.form].filter(Boolean).join(" · ") || "Producto",
                i.quantity_t != null ? i.quantity_t.toLocaleString("en-US") : "—",
                i.quantity_t != null ? (i.quantity_t * 1.02).toFixed(2) : "—",
              ],
            ],
          },
          { kind: "signature", parties: ["Vendedor"] },
        ],
      };

    default:
      return null;
  }
}
