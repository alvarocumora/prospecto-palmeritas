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
const fmtT = (n: number | null | undefined) =>
  n != null ? `${n.toLocaleString("es-CL")} t` : "—";
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
      text:
        "Consolidación del Informe Técnico de Análisis de Resultados (ALS · método ME-MS82) para el Proyecto TRENTO. Base analítica: 189 muestras distribuidas en 4 certificados. Elementos analizados: La, Ce, Pr, Nd, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu, Y. Valores en ppm (1 ppm = 1 g/t).",
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
