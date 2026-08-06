// Documentos comerciales bilingües (ES/EN) de una operación: ICPO, FCO e IMFPA.
// Lógica pura y client-safe: recibe los datos de la operación y devuelve un
// GeneratedDoc que se imprime con el renderer institucional (documents/pdf).

import type { GeneratedDoc } from "./model";

export type DocLang = "es" | "en" | "both";

/** Emite una línea ES sobre EN según el idioma pedido. */
export function biline(es: string, en: string, lang: DocLang = "both"): string {
  if (lang === "es") return es;
  if (lang === "en") return en;
  return `${es}\n${en}`;
}

export type TradeDocInput = {
  reference?: string | null;
  commodity?: string | null;
  productName?: string | null;
  presentation?: string | null;
  purity?: string | null;
  packaging?: string | null;
  origin?: string | null;
  incoterm?: string | null;
  destination?: string | null;
  quantity?: string | null;
  frequency?: string | null;
  contractMonths?: number | null;
  price?: string | null;
  buyer?: string | null;
  seller?: string | null;
  intermediary?: string | null;
  commission?: string | null;
  paymentInstrument?: string | null;
  validityDays?: number | null;
  jurisdiction?: string | null;
};

export type TradeDocKind = "icpo" | "fco" | "imfpa";

export const TRADE_DOC_LABELS: Record<TradeDocKind, { es: string; en: string }> = {
  icpo: { es: "Orden de compra irrevocable", en: "Irrevocable Corporate Purchase Order" },
  fco: { es: "Oferta corporativa completa", en: "Full Corporate Offer" },
  imfpa: { es: "Acuerdo de pago de comisiones", en: "Irrevocable Master Fee Protection Agreement" },
};

const v = (s: string | null | undefined, fb: string) => (s && String(s).trim() ? String(s).trim() : fb);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function reference(input: TradeDocInput, kind: TradeDocKind): string {
  const base = v(input.reference, "GC-OP");
  return `${base}-${kind.toUpperCase()}`;
}

function commonRows(i: TradeDocInput, lang: DocLang): Array<[string, string]> {
  return [
    [biline("Comprador", "Buyer", lang), v(i.buyer, "[—]")],
    [biline("Vendedor", "Seller", lang), v(i.seller, "[—]")],
    [biline("Producto", "Product", lang), v(i.productName ?? i.commodity, "[—]")],
    [biline("Presentación", "Presentation", lang), v(i.presentation, "—")],
    [biline("Pureza / ley", "Purity / grade", lang), v(i.purity, "—")],
    [biline("Envase", "Packaging", lang), v(i.packaging, "—")],
    [biline("Procedencia", "Origin", lang), v(i.origin, "—")],
    [biline("Cantidad por pedido", "Quantity per order", lang), v(i.quantity, "—")],
    [biline("Frecuencia", "Frequency", lang), v(i.frequency, "—")],
    [
      biline("Contrato", "Contract term", lang),
      i.contractMonths ? `${i.contractMonths} ${lang === "en" ? "months" : "meses"}` : "—",
    ],
    [
      biline("Incoterm 2020", "Incoterm 2020", lang),
      `${v(i.incoterm, "CIF")}${i.destination ? ` ${i.destination}` : ""}`,
    ],
    [biline("Precio", "Price", lang), v(i.price, "—")],
    [biline("Instrumento de pago", "Payment instrument", lang), v(i.paymentInstrument, "DLC / SBLC")],
  ];
}

export function buildTradeDoc(
  kind: TradeDocKind,
  input: TradeDocInput,
  lang: DocLang = "both",
): GeneratedDoc {
  const jur = v(input.jurisdiction, "República de Chile");
  const validity = input.validityDays ?? 10;
  const buyer = v(input.buyer, "[Comprador / Buyer]");
  const seller = v(input.seller, "[Vendedor / Seller]");
  const product = v(input.productName ?? input.commodity, "[producto / product]");
  const price = v(input.price, "[precio / price]");
  const pay = v(input.paymentInstrument, "DLC");
  const incoterm = `${v(input.incoterm, "CIF")}${input.destination ? ` ${input.destination}` : ""}`;

  const lawClause = biline(
    `LEY APLICABLE Y ARBITRAJE. El presente instrumento se rige por las leyes de ${jur}; las controversias se someterán a arbitraje. En caso de discrepancia prevalece la versión en español.`,
    `GOVERNING LAW & ARBITRATION. This instrument is governed by the laws of ${jur}; disputes shall be submitted to arbitration. In case of discrepancy the Spanish version prevails.`,
    lang,
  );

  if (kind === "icpo") {
    return {
      docType: "icpo",
      reference: reference(input, "icpo"),
      date: today(),
      title: "IRREVOCABLE CORPORATE PURCHASE ORDER (ICPO)",
      blocks: [
        {
          kind: "paragraph",
          text: biline(
            `${buyer} (el "Comprador") emite la presente Orden de Compra Corporativa Irrevocable a favor de ${seller} (el "Vendedor") para la adquisición de ${product}, intermediada por Geocapitals.`,
            `${buyer} (the "Buyer") hereby issues this Irrevocable Corporate Purchase Order in favor of ${seller} (the "Seller") for the purchase of ${product}, intermediated by Geocapitals.`,
            lang,
          ),
        },
        { kind: "fields", rows: commonRows(input, lang) },
        {
          kind: "clauses",
          items: [
            biline(
              `OBJETO. El Comprador se compromete irrevocablemente a adquirir el producto y las cantidades indicadas, sujeto a la aceptación del Vendedor mediante su Oferta Corporativa (FCO) y a la firma del contrato definitivo.`,
              `PURPOSE. The Buyer irrevocably undertakes to purchase the product and quantities stated, subject to the Seller's acceptance via its Full Corporate Offer (FCO) and execution of the definitive contract.`,
              lang,
            ),
            biline(
              `PRECIO Y AJUSTE. El precio se establece en ${price}, sujeto al mecanismo de ajuste y a la inspección independiente de calidad y cantidad en puerto de carga.`,
              `PRICE & ADJUSTMENT. The price is set at ${price}, subject to the agreed adjustment mechanism and independent quality/quantity inspection at the loading port.`,
              lang,
            ),
            biline(
              `PAGO. Mediante ${pay}, emitido por banco de primer orden contra documentos de embarque conformes.`,
              `PAYMENT. By ${pay}, issued by a first-class bank against conforming shipping documents.`,
              lang,
            ),
            biline(
              `INCOTERM. La entrega se pacta ${incoterm} (Incoterms 2020).`,
              `INCOTERM. Delivery is agreed ${incoterm} (Incoterms 2020).`,
              lang,
            ),
            biline(
              `VALIDEZ. La presente orden es válida por ${validity} días corridos desde su emisión.`,
              `VALIDITY. This order is valid for ${validity} calendar days from issuance.`,
              lang,
            ),
            lawClause,
          ],
        },
        { kind: "signature", parties: [buyer] },
      ],
    };
  }

  if (kind === "fco") {
    return {
      docType: "fco",
      reference: reference(input, "fco"),
      date: today(),
      title: "FULL CORPORATE OFFER (FCO)",
      blocks: [
        {
          kind: "paragraph",
          text: biline(
            `${seller} (el "Vendedor") emite la presente Oferta Corporativa Completa a favor de ${buyer} (el "Comprador") por el suministro de ${product}, bajo intermediación de Geocapitals.`,
            `${seller} (the "Seller") hereby issues this Full Corporate Offer in favor of ${buyer} (the "Buyer") for the supply of ${product}, intermediated by Geocapitals.`,
            lang,
          ),
        },
        { kind: "fields", rows: commonRows(input, lang) },
        {
          kind: "clauses",
          items: [
            biline(
              `OFERTA. El Vendedor ofrece en firme el producto y cantidades señaladas, sujeto a disponibilidad y confirmación de origen.`,
              `OFFER. The Seller firmly offers the product and quantities stated, subject to availability and origin confirmation.`,
              lang,
            ),
            biline(
              `CALIDAD E INSPECCIÓN. Calidad garantizada según especificaciones; inspección por entidad independiente (SGS / Alfred H. Knight u otra acordada) en puerto de carga, con costos por cuenta del Comprador salvo pacto en contrario.`,
              `QUALITY & INSPECTION. Quality guaranteed per specifications; inspection by an independent surveyor (SGS / Alfred H. Knight or as agreed) at the loading port, at Buyer's cost unless otherwise agreed.`,
              lang,
            ),
            biline(
              `PROCEDIMIENTO. ICPO → FCO → contrato de suministro → instrumento de pago → inspección → embarque → liberación de documentos.`,
              `PROCEDURE. ICPO → FCO → supply contract → payment instrument → inspection → shipment → release of documents.`,
              lang,
            ),
            biline(
              `PAGO. ${pay} irrevocable, confirmado y operativo, emitido dentro de 7 días bancarios desde la firma del contrato.`,
              `PAYMENT. Irrevocable, confirmed and operative ${pay}, issued within 7 banking days from contract execution.`,
              lang,
            ),
            biline(
              `COMISIONES. Las comisiones de intermediación se pagan conforme al IMFPA firmado por las partes, con cargo a la cuenta del Vendedor.`,
              `COMMISSIONS. Intermediation fees are payable under the IMFPA executed by the parties, for the Seller's account.`,
              lang,
            ),
            biline(
              `VALIDEZ. Esta oferta es válida por ${validity} días corridos desde su emisión.`,
              `VALIDITY. This offer is valid for ${validity} calendar days from issuance.`,
              lang,
            ),
            lawClause,
          ],
        },
        { kind: "signature", parties: [seller] },
      ],
    };
  }

  // IMFPA
  const intermediary = v(input.intermediary, "Geocapitals SpA");
  const commission = v(input.commission, "[monto o % de comisión / fee amount or %]");
  return {
    docType: "imfpa",
    reference: reference(input, "imfpa"),
    date: today(),
    title: "IRREVOCABLE MASTER FEE PROTECTION AGREEMENT (IMFPA)",
    blocks: [
      {
        kind: "paragraph",
        text: biline(
          `${seller} (el "Pagador") se obliga irrevocablemente a pagar a ${intermediary} (el "Beneficiario") las comisiones de intermediación derivadas de la operación de ${product} con ${buyer}.`,
          `${seller} (the "Payer") irrevocably undertakes to pay ${intermediary} (the "Beneficiary") the intermediation fees arising from the ${product} transaction with ${buyer}.`,
          lang,
        ),
      },
      {
        kind: "fields",
        rows: [
          [biline("Pagador", "Payer", lang), seller],
          [biline("Beneficiario", "Beneficiary", lang), intermediary],
          [biline("Operación", "Transaction", lang), `${product}${input.reference ? ` · ${input.reference}` : ""}`],
          [biline("Incoterm", "Incoterm", lang), incoterm],
          [biline("Comisión", "Fee", lang), commission],
          [biline("Instrumento de pago", "Payment instrument", lang), pay],
          [biline("Jurisdicción", "Jurisdiction", lang), jur],
        ],
      },
      {
        kind: "clauses",
        items: [
          biline(
            `IRREVOCABILIDAD. El Pagador reconoce que la comisión indicada es irrevocable, incondicional y transferible, y se devenga por cada embarque de la operación y de sus renovaciones o extensiones.`,
            `IRREVOCABILITY. The Payer acknowledges that the stated fee is irrevocable, unconditional and assignable, accruing on each shipment of the transaction and on any renewal or extension thereof.`,
            lang,
          ),
          biline(
            `PAGO. La comisión se paga por transferencia bancaria dentro de las 48 horas siguientes al pago del embarque correspondiente, simultáneamente con la liquidación del Vendedor.`,
            `PAYMENT. The fee shall be paid by wire transfer within 48 hours of settlement of the relevant shipment, simultaneously with the Seller's proceeds.`,
            lang,
          ),
          biline(
            `NO ELUSIÓN. Las partes se obligan a no eludir ni desintermediar al Beneficiario respecto de las contrapartes presentadas, por un plazo de cinco (5) años.`,
            `NON-CIRCUMVENTION. The parties undertake not to circumvent or bypass the Beneficiary in respect of the introduced counterparties for a period of five (5) years.`,
            lang,
          ),
          biline(
            `CONFIDENCIALIDAD. Los términos comerciales, datos de contrapartes y coordenadas bancarias son confidenciales y no podrán divulgarse sin autorización escrita.`,
            `CONFIDENTIALITY. Commercial terms, counterparty data and banking coordinates are confidential and shall not be disclosed without written consent.`,
            lang,
          ),
          lawClause,
        ],
      },
      { kind: "signature", parties: [seller, intermediary] },
    ],
  };
}

/** Ficha técnica comercial de la operación en formato documento. */
export function buildTradeFichaDoc(input: TradeDocInput, lang: DocLang = "both"): GeneratedDoc {
  return {
    docType: "ficha",
    reference: `${v(input.reference, "GC-OP")}-FICHA`,
    date: today(),
    title: biline("FICHA DE OPERACIÓN", "TRANSACTION FACT SHEET", lang === "both" ? "es" : lang),
    blocks: [
      {
        kind: "paragraph",
        text: biline(
          `Resumen comercial de la operación de ${v(input.productName ?? input.commodity, "commodity")} intermediada por Geocapitals. Contiene condiciones públicas de venta y especificaciones del producto.`,
          `Commercial summary of the ${v(input.productName ?? input.commodity, "commodity")} transaction intermediated by Geocapitals. It contains public sale conditions and product specifications.`,
          lang,
        ),
      },
      { kind: "fields", rows: commonRows(input, lang) },
      {
        kind: "paragraph",
        text: biline(
          "Documento comercial preliminar. No constituye oferta vinculante. Contacto: info@geocapitals.com · WhatsApp +56 9 6218 4071.",
          "Preliminary commercial document. It does not constitute a binding offer. Contact: info@geocapitals.com · WhatsApp +56 9 6218 4071.",
          lang,
        ),
      },
    ],
  };
}
