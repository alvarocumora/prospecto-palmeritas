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
