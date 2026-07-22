// Construye un GeneratedDoc a partir de una ficha de proveedor pública
// (SupplierSheet) y lo renderiza al mismo modelo Institutional Modernist
// que el resto de documentos de Geocapitals — para poder descargar y
// compartir la ficha offline con clientes compradores.

import type { GeneratedDoc } from "@/lib/documents/model";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";
import type { SupplierSheet } from "@/lib/sourcing.functions";
import { SUPPLIER_ROLE_LABELS, normalizeSupplierRole } from "@/lib/sourcing";

const fmtUsdT = (n: number | null | undefined) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}/t` : "—";
const fmtT = (n: number | null | undefined) => (n != null ? `${n.toLocaleString("es-CL")} t` : "—");
const dash = (v: string | null | undefined) => (v && v.trim() ? v : "—");

export function buildSupplierSheetDoc(sheet: SupplierSheet): GeneratedDoc {
  const { request, supplier } = sheet;
  const roleLabel = supplier.supplier_role
    ? (SUPPLIER_ROLE_LABELS[normalizeSupplierRole(supplier.supplier_role) ?? "otro"] ??
      supplier.supplier_role)
    : null;

  const identidad: Array<[string, string]> = [
    ["Proveedor", supplier.supplier_name],
    ["Empresa", dash(supplier.supplier_company)],
    ["País / procedencia", dash(supplier.supplier_country)],
    ...(roleLabel ? ([["Rol", roleLabel]] as Array<[string, string]>) : []),
    ["Contacto", dash(supplier.contact_email)],
    ["Teléfono", dash(supplier.contact_phone)],
  ];

  const requerimiento: Array<[string, string]> = [
    ["Referencia RFQ", request.reference],
    ["Commodity", request.commodity],
    ["Forma", dash(request.form)],
    ["Cantidad solicitada", fmtT(request.quantityT)],
    ["Incoterm", dash(request.incoterm)],
    ["Destino", dash(request.destination)],
  ];

  const oferta: string[][] = [
    ["Precio", fmtUsdT(supplier.offer_price_usd_t)],
    ["Cantidad ofertada", fmtT(supplier.offer_quantity_t)],
    ["Incoterm", dash(supplier.incoterm)],
    ["Puerto de carga", dash(supplier.port_loading)],
    ["Plazo de entrega", dash(supplier.lead_time)],
    ["Condiciones de pago", dash(supplier.payment_terms)],
    ["Calidad / ley", dash(supplier.quality_grade)],
    ["Empaque", dash(supplier.packaging)],
    ["Oferta válida hasta", dash(supplier.offer_valid_until)],
  ];

  const blocks: GeneratedDoc["blocks"] = [
    {
      kind: "paragraph",
      text: `Ficha de proveedor emitida por Geocapitals a partir de la propuesta recibida para el requerimiento ${request.reference} (${request.commodity}). Documento de referencia comercial — no constituye oferta vinculante.`,
    },
    { kind: "fields", rows: identidad },
    { kind: "fields", rows: requerimiento },
    { kind: "table", head: ["Concepto", "Valor"], rows: oferta },
  ];

  // Consolidación técnica específica: Informe ALS de Tierras Raras · Proyecto TRENTO
  const isTrentoRee =
    /TRENTO/i.test(request.reference) || /tierras raras|ree|rare earth/i.test(request.commodity);
  if (isTrentoRee) {
    blocks.push({
      kind: "paragraph",
      text: "Consolidación del Informe Técnico de Análisis de Resultados (ALS · método ME-MS82) para el Proyecto TRENTO. Base analítica: 189 muestras distribuidas en 4 certificados. Elementos analizados: La, Ce, Pr, Nd, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu, Y. Valores en ppm (1 ppm = 1 g/t).",
    });
    blocks.push({
      kind: "table",
      head: ["Certificado", "Código ALS", "N° muestras"],
      rows: [
        ["TEST 656", "LS16037656", "22"],
        ["TEST 157", "CO16055157", "17"],
        ["TEST 697", "CO16082697", "56"],
        ["TEST 947", "CO16084947", "94"],
        ["Total", "—", "189"],
      ],
    });
    blocks.push({
      kind: "table",
      head: ["Indicador global", "Valor"],
      rows: [
        ["Maximo SigmaREE observado", "2.055,80 ppm (2,056 kg/t)"],
        ["Muestras > 1.000 ppm SigmaREE (TEST 656)", "6"],
        ["Relacion LREE/HREE (muestra 1020)", "9,46"],
        ["Perfil dominante", "LREE (Ce+La+Nd+Pr > 90% del SigmaREE)"],
        ["Metodo analitico", "ALS ME-MS82 (fusion Na2O2 + ICP-MS)"],
      ],
    });
    blocks.push({
      kind: "table",
      head: ["Elemento", "% del SigmaREE promedio", "Grupo"],
      rows: [
        ["Ce (Cerio)", "42,34 %", "LREE"],
        ["La (Lantano)", "31,44 %", "LREE"],
        ["Nd (Neodimio)", "13,60 %", "LREE"],
        ["Pr (Praseodimio)", "4,67 %", "LREE"],
        ["Sm + Eu", "~ 3 %", "LREE"],
        ["Gd-Lu + Y", "~ 5 %", "HREE"],
      ],
    });
    blocks.push({
      kind: "table",
      head: ["#", "Muestra", "SigmaREE (ppm)", "LREE (ppm)", "HREE (ppm)", "LREE/HREE"],
      rows: [
        ["1", "1020", "1.261,50", "1.140,90", "120,60", "9,46"],
        ["2", "1007", "> 1.000", "—", "—", "—"],
        ["3", "1008", "> 1.000", "—", "—", "—"],
        ["4", "1010", "> 1.000", "—", "—", "—"],
        ["5", "1006", "> 1.000", "—", "—", "—"],
        ["6", "1019", "> 1.000", "—", "—", "—"],
      ],
    });
    blocks.push({
      kind: "table",
      head: ["Muestra destacada", "Certificado", "Elementos donde marca maximo"],
      rows: [
        ["1132", "TEST 157", "Gd, Tb, Dy, Ho (HREE)"],
        ["1131", "TEST 157", "Er, Tm, Yb, Lu, Y (HREE)"],
        ["1133 / 1135", "TEST 157", "Alta concentracion LREE"],
        ["1020 / 1007 / 1008 / 1010 / 1006 / 1019", "TEST 656", "SigmaREE > 1.000 ppm"],
      ],
    });
    blocks.push({
      kind: "clauses",
      items: [
        "El contenido total de tierras raras está dominado por LREE (Ce, La, Nd, Pr), con participación relevante de Y dentro del grupo HREE.",
        "La distribución no es homogénea: pocas muestras concentran la mayor parte del SigmaREE, lo que sugiere zonas mineralizadas focalizadas dentro del proyecto.",
        "Valores obtenidos por ALS mediante ME-MS82; no incluyen información mineralógica ni de recuperación metalúrgica.",
        "Datos utilizados con fines exploratorios y comparativos entre certificados; no constituyen estimación de recursos NI 43-101.",
      ],
    });
  }

  // Consolidación específica: Antimonio en breña · SCO Corp. Minera A&D (Honduras).
  const isAntimonyBrena =
    /SB-BRENA|ANTIMONIO.*BRE|BRENA.*ANTIMONIO/i.test(request.reference) ||
    (/antimon/i.test(request.commodity) &&
      /bre[nñ]a/i.test(`${request.form} ${supplier.packaging}`));
  if (isAntimonyBrena) {
    blocks.push({
      kind: "paragraph",
      text: "Detalle del mineral ofertado — Antimonio (Sb) en breña. Datos tomados de la Soft Corporate Offer (SCO) del proveedor. Precio en USD por tonelada métrica, con impuestos, escalonado por ley de antimonio; ante variación de la bolsa internacional se ajusta de manera proporcional.",
    });
    blocks.push({
      kind: "table",
      head: ["Característica", "Detalle"],
      rows: [
        ["Producto", "Antimonio (Sb) en breña — mineral triturado"],
        ["Origen", "Honduras"],
        ["Granulometría", "1 pulgada a finos"],
        ["Ley (rango)", "35% a 77% Sb"],
        ["Presentación", "Breña / mineral a granel"],
        ["Disponibilidad", "100 t/mes (a más)"],
        ["Período de contrato", "1 año (12 meses), a más"],
        ["Modalidad", "FOB"],
        [
          "Puertos de embarque",
          "Puerto Cortés (Cortés) · Puerto Castilla (Colón) · San Lorenzo (Choluteca)",
        ],
      ],
    });
    // Tabla de leyes y precios (US$/MT), pareada en dos bloques como en la SCO.
    const priceByGrade: Array<[number, number]> = [
      [35, 5616],
      [36, 5649],
      [37, 5683],
      [38, 5717],
      [39, 5750],
      [40, 5784],
      [41, 5816],
      [42, 5849],
      [43, 5881],
      [44, 5914],
      [45, 5946],
      [46, 5979],
      [47, 6011],
      [48, 6044],
      [49, 6076],
      [50, 6108],
      [51, 6141],
      [52, 6173],
      [53, 6206],
      [54, 6238],
      [55, 6271],
      [56, 6303],
      [57, 6336],
      [58, 6368],
      [59, 6401],
      [60, 6433],
      [61, 6465],
      [62, 6498],
      [63, 6530],
      [64, 6563],
      [65, 6595],
      [66, 6628],
      [67, 6660],
      [68, 6693],
      [69, 6725],
      [70, 6757],
      [71, 6790],
      [72, 6822],
      [73, 6855],
      [74, 6888],
      [75, 6920],
      [76, 6952],
      [77, 7030],
    ];
    const money = (n: number) => `US$ ${n.toLocaleString("es-CL")}`;
    const half = Math.ceil(priceByGrade.length / 2);
    const left = priceByGrade.slice(0, half);
    const right = priceByGrade.slice(half);
    const priceRows = left.map((l, i) => {
      const r = right[i];
      return [`${l[0]}%`, money(l[1]), r ? `${r[0]}%` : "", r ? money(r[1]) : ""];
    });
    blocks.push({
      kind: "table",
      head: ["Ley % Sb", "Precio/MT", "Ley % Sb", "Precio/MT"],
      rows: priceRows,
    });
    blocks.push({
      kind: "clauses",
      items: [
        "Precios en dólares americanos por tonelada métrica (MT), con impuestos; ajustables proporcionalmente ante variación de la bolsa internacional de antimonio.",
        "Modalidad FOB en los puertos indicados. El proveedor declara ser titular de las concesiones mineras.",
        "Pago mediante SBLC 100% irrevocable, transferible y divisible, con pago en el puerto de carga tras informes de inspección y documentos de embarque vía SWIFT MT103. Banca: Bank of America (intermediario), Banco FICOHSA (beneficiario), beneficiario final Corporación Minera A&D, S.A. de C.V.",
        "Oferta dirigida solo a compradores directos que acrediten prueba de fondos (POF). Documento de referencia comercial — no constituye oferta vinculante.",
      ],
    });
  }

  if (supplier.specs && supplier.specs.trim()) {
    blocks.push({ kind: "paragraph", text: `Especificaciones técnicas: ${supplier.specs.trim()}` });
  }
  if (supplier.notes && supplier.notes.trim()) {
    blocks.push({ kind: "paragraph", text: `Notas: ${supplier.notes.trim()}` });
  }
  if (supplier.documents.length > 0) {
    blocks.push({
      kind: "table",
      head: ["#", "Documento aportado"],
      rows: supplier.documents.map((d, i) => [String(i + 1), d.label || `Documento ${i + 1}`]),
    });
  }

  blocks.push({
    kind: "paragraph",
    text: "Verifica la autenticidad de esta ficha escaneando el QR del pie de página o visitando geocapitals.com. Contacto operativo: info@geocapitals.com · WhatsApp +56 9 6218 4071.",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const refSlug = `FICHA-${request.reference}-${supplier.supplier_name}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return {
    docType: "ficha-proveedor",
    title: `Ficha de proveedor · ${supplier.supplier_name}`,
    reference: `${refSlug}-${stamp}`,
    date: stamp,
    blocks,
  };
}

export async function downloadSupplierSheetPdf(sheet: SupplierSheet): Promise<void> {
  await renderGeocapitalsPdf(buildSupplierSheetDoc(sheet));
}
