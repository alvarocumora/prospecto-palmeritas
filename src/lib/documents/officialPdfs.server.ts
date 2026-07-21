// Cuerpos de los PDFs oficiales adjuntos por email.
// Se mantienen breves y en español, pensados para "copia de bandeja" que la
// contraparte pueda leer sin abrir la plataforma. La copia firmable completa
// vive en la ruta de firma electrónica.

import { renderServerPdf, uploadPdfSigned } from "./pdfServer.server";
import { OWN_COMPANY, OWN_PARTY_LINE } from "./company";

type Party = { role: string; name: string; company?: string; email?: string };

const EMITTER = {
  name: OWN_COMPANY.representative,
  role: `${OWN_COMPANY.name} · Rep. legal — por Geocapitals`,
  email: "info@geocapitals.com",
};

export async function buildNdaPdf(input: {
  reference: string;
  counterparty: Party;
  purpose: string;
  jurisdiction?: string;
  termMonths?: number;
}): Promise<Uint8Array> {
  const jur = input.jurisdiction ?? "República de Chile";
  const term = input.termMonths ?? 24;
  return await renderServerPdf({
    title: "Acuerdo Mutuo de Confidencialidad (NDA)",
    subtitle:
      "Acuerdo mutuo de no divulgación aplicable a la evaluación y ejecución de la operación indicada. " +
      "Copia oficial emitida por Geocapitals para la bandeja de la contraparte; la firma electrónica " +
      "vinculante se realiza en el enlace personal enviado por separado.",
    reference: input.reference,
    parties: [
      { role: "Parte A", name: OWN_PARTY_LINE },
      {
        role: "Parte B",
        name: input.counterparty.name,
        company: input.counterparty.company,
        email: input.counterparty.email,
      },
    ],
    body: [
      "1 · OBJETO. Las Partes se comprometen mutuamente a mantener la confidencialidad de toda información técnica, comercial, financiera, operativa o de cualquier otra naturaleza que se intercambie con ocasión de: " +
        input.purpose +
        ".",
      "2 · INFORMACIÓN CONFIDENCIAL. Se considera Información Confidencial toda aquella entregada por escrito, verbalmente o por medios electrónicos, incluyendo especificaciones técnicas, análisis químicos (CoA, SGS), listas de precios, condiciones comerciales, identidad de contrapartes finales, rutas logísticas, esquemas de pago y cualquier documento marcado o razonablemente entendible como reservado.",
      "3 · USO PERMITIDO. La Información Confidencial se usará exclusivamente para evaluar y ejecutar la operación. Su divulgación a terceros requiere autorización escrita previa; la única excepción son asesores profesionales sujetos a deber de reserva equivalente.",
      "4 · VIGENCIA. Este acuerdo estará vigente por " +
        term +
        " meses desde la fecha de emisión y sobrevivirá al término de las negociaciones respecto a la información recibida durante su vigencia.",
      "5 · NO-CIRCUMVENTION. Ninguna de las Partes contactará ni cerrará operaciones con las contrapartes, proveedores o clientes finales identificados por la otra Parte, sin su consentimiento escrito, por el mismo plazo de vigencia.",
      "6 · DEVOLUCIÓN Y DESTRUCCIÓN. A solicitud escrita, la Información Confidencial deberá devolverse o destruirse, con constancia por email a info@geocapitals.com.",
      "7 · LEY APLICABLE. Este acuerdo se rige por las leyes de " + jur + ". Cualquier controversia se someterá al arbitraje del Centro de Arbitraje de la Cámara de Comercio respectiva.",
      "---",
      "Este PDF es la copia oficial para archivo. La firma electrónica de este NDA se realiza en el enlace personal enviado por Geocapitals; una vez firmado por ambas Partes, quedará registrado con sello de tiempo y hash SHA-256 en la plataforma.",
    ],
    emitter: { ...EMITTER, signedAtISO: new Date().toISOString() },
    issuedAtISO: new Date().toISOString(),
  });
}

export async function buildLoiPdf(input: {
  reference: string;
  counterparty: Party;
  commodity: string;
  quantity?: string;
  incoterm?: string;
  destination?: string;
  paymentInstrument?: string;
  validityDays?: number;
}): Promise<Uint8Array> {
  const validity = input.validityDays ?? 30;
  return await renderServerPdf({
    title: "Carta de Intención (LOI)",
    subtitle:
      "Manifestación de interés no vinculante para la compra del commodity indicado, sujeta a due " +
      "diligence, inspección independiente y firma de contrato definitivo (SPA). Copia oficial emitida " +
      "por Geocapitals; la firma electrónica se realiza en el enlace personal.",
    reference: input.reference,
    parties: [
      { role: "Buyer / Intermediario", name: OWN_PARTY_LINE },
      {
        role: "Seller / Proveedor",
        name: input.counterparty.name,
        company: input.counterparty.company,
        email: input.counterparty.email,
      },
    ],
    body: [
      "1 · PRODUCTO. " + input.commodity + ".",
      "2 · CANTIDAD Y ENTREGA. " +
        (input.quantity ?? "A definir en SPA") +
        ". Incoterm: " +
        (input.incoterm ?? "CIF") +
        (input.destination ? ` con destino ${input.destination}` : "") +
        ". Cronograma y puerto de embarque se acordarán en el contrato definitivo.",
      "3 · CALIDAD. La calidad se determinará mediante análisis independiente (SGS / Bureau Veritas / Alfred H. Knight) sobre muestreo en origen, con derecho a re-muestreo en destino. Los CoA y SGS ya intercambiados sirven como referencia técnica preliminar.",
      "4 · PAGO. " +
        (input.paymentInstrument ?? "SBLC MT760 irrevocable, confirmada por banco de primer nivel") +
        ". Emisión y confirmación sujetas a wording MT799 previo (POF/RWA).",
      "5 · DILIGENCIA. El Buyer podrá realizar visita a bodega, verificación de origen legal del material, KYC/AML del Seller y validación de documentación de exportación antes de la firma del SPA.",
      "6 · CONFIDENCIALIDAD. Esta LOI se emite bajo el NDA suscrito entre las Partes y no constituye obligación de compra hasta la firma del SPA definitivo. Cualquier comunicación con contrapartes finales requiere consentimiento escrito.",
      "7 · VIGENCIA. Esta LOI tiene validez por " + validity + " días desde su emisión. Vencido el plazo sin firma de SPA, quedará sin efecto salvo prórroga escrita.",
      "---",
      "Documento no vinculante en cuanto a la obligación de compra. Sí es vinculante en materia de confidencialidad y no-circumvention, en los términos del NDA suscrito.",
    ],
    emitter: { ...EMITTER, signedAtISO: new Date().toISOString() },
    issuedAtISO: new Date().toISOString(),
  });
}

export async function buildAntimonySheetPdf(input: {
  reference: string;
  recipient: Party;
}): Promise<Uint8Array> {
  const assays: Array<[string, string, string, string]> = [
    ["Sb (Antimonio)", "%", "99.85 / 99.90", "99.75"],
    ["As (Arsénico)", "%", "0.015 – 0.036", "0.032"],
    ["Pb (Plomo)", "%", "0.012 – 0.041", "0.20"],
    ["Fe (Hierro)", "%", "0.0028 – 0.0030", "0.0023"],
    ["S (Azufre)", "%", "0.0042 – 0.0047", "0.0026"],
    ["Cu (Cobre)", "%", "0.026 – 0.029", "0.0053"],
    ["Se (Selenio)", "%", "0.0010 – 0.0058", "<0.0010"],
    ["Bi (Bismuto)", "%", "0.0016", "0.0007"],
    ["Cd (Cadmio)", "%", "0.0004", "—"],
    ["Ag (Plata)", "%", "0.0003 – 0.014", "—"],
    ["Sn (Estaño)", "%", "0.0008", "—"],
  ];
  const chem = [
    "Composición química — CoA productor (JH2601, pallets 26–50 y 301–320) vs SGS (Reporte 2025-2002470-001, muestreo 22-Aug-2025).",
    ...assays.map(
      ([el, u, a, b]) =>
        `· ${el.padEnd(18, " ")} ${u.padEnd(3, " ")}  CoA: ${a.padEnd(18, " ")}  SGS: ${b}`,
    ),
  ];
  return await renderServerPdf({
    title: "Purchase Terms · Antimony Ingots (Sb)",
    subtitle:
      "Condiciones formales de compra para el Buyer en Florida, USA (1,500 MT/mes × 12 meses, " +
      "CIF, pago SWIFT MT103). Incluye ficha técnica del lote ofrecido por proveedor certificado. " +
      "Emitido por Geocapitals bajo el NCNDA firmado entre las Partes.",
    reference: input.reference,
    parties: [
      { role: "Emisor", name: `${OWN_COMPANY.name} — Geocapitals` },
      {
        role: "Destinatario",
        name: input.recipient.name,
        company: input.recipient.company,
        email: input.recipient.email,
      },
    ],
    body: [
      "§1 · COMMODITY. Refined Antimony Metal Ingots (Sb). Pureza mínima 99.65% (superior por mutuo acuerdo). Estándar: International Commercial Grade · Standard Ingots. Marca de producción JH2601 / KRN (referencia). Presentación: pallets 300–320 / 26–50. Origen: Seller's Option. Trial Shipment opcional por mutuo acuerdo. Estándar de análisis: GB/T 1599-2014.",
      "§2 · CONTRACT QUANTITY & DURATION. 1,500 Metric Tons por mes. Contrato mínimo doce (12) meses, renovable por mutuo acuerdo escrito.",
      "§3 · DELIVERY TERMS. Incoterm: CIF — Buyer's Designated Port, Florida, USA. Loading Port: Seller's Option. Destination Port: puerto designado por el Buyer en Florida, EE.UU. Schedule: primer embarque dentro de 15–30 días bancarios tras la firma del SPA; embarques mensuales sucesivos por la duración del contrato.",
      "§4 · PRICE. El precio se referenciará al índice internacional aplicable para antimonio refinado. Dado que no existe un contrato LME estándar para antimonio, se acordará expresamente en el SPA la fuente de precio (LMU/LME reference u otro índice publicado, ej. Fastmarkets), la ventana de fijación, descuentos, premios y comisiones.",
      "§5 · PAYMENT TERMS · SWIFT MT103. Transferencia bancaria internacional (SWIFT MT103) contra Commercial Invoice del Seller y set completo de documentos de embarque. Fondos remitidos a la cuenta bancaria designada por el Seller. Cargos bancarios fuera del país del Seller por cuenta del Buyer. Milestones alternativos podrán definirse en el SPA por mutuo acuerdo. NO SE UTILIZARÁ SBLC NI DLC para esta operación.",
      "§6 · PROOF OF PRODUCT (POP). Commercial Invoice · Packing List · Certificate of Origin · SGS Quality Certificate (o equivalente) · Product Specification Sheet · Warehouse Receipt / Availability Certificate (cuando aplique) · Export Authorization · Product Photographs · Draft Bill of Lading.",
      "§7 · SHIPPING DOCUMENTS. Commercial Invoice · Packing List · Full Set Clean On Board Bills of Lading · Certificate of Origin · SGS Inspection Certificate · Weight Certificate · Quality Certificate · Insurance Certificate (CIF) · Export Customs Documentation · Container Loading Photographs.",
      "§8 · INSPECTION. Inspección de calidad y cantidad por SGS, CCIC, Alex Stewart International u otra firma internacionalmente reconocida y mutuamente aceptada. El Buyer podrá realizar inspección de destino por su propia cuenta.",
      "§9 · TRANSACTION PROCEDURE. (1) Buyer emite ICPO/LOI + Company Profile; (2) Seller emite FCO + CIS; (3) Buyer firma y devuelve FCO; (4) Seller emite Draft SPA; (5) Buyer firma y devuelve; (6) Seller contrafirma; (7) Commercial Invoice; (8) Confirmación de PO y cronograma; (9) Preparación de carga; (10) Inspección SGS/CCIC; (11) Embarque según cronograma; (12) Set completo de documentos; (13) Pago SWIFT MT103 según SPA; (14) Arribo a puerto en Florida, EE.UU.; (15) Inspección de destino si aplica.",
      "§10 · COMMISSIONS. Toda comisión, fee de intermediación o compensación de facilitador se acordará por separado por las Partes y será incorporada expresamente al SPA definitivo y al Fee Protection Agreement (NCNDA/IMFPA), cuando corresponda.",
      "§11 · BUYER. Ubicación: Florida, Estados Unidos. Cantidad requerida: 1,500 MT/mes. Contrato mínimo: 12 meses. Extensiones sujetas a acuerdo escrito mutuo.",
      "---",
      "FICHA TÉCNICA DEL LOTE — Análisis químico (CoA productor vs SGS independiente).",
      ...chem,
      "---",
      "Este documento oficial resume las condiciones comerciales y técnicas para la operación indicada, bajo el NCNDA suscrito entre las Partes. NO constituye oferta vinculante; la obligación de compra nace con el SPA definitivo firmado. Contacto: info@geocapitals.com · WhatsApp +56 9 6218 4071.",
    ],
    emitter: { ...EMITTER, signedAtISO: new Date().toISOString() },
    issuedAtISO: new Date().toISOString(),
  });
}

export { uploadPdfSigned };
