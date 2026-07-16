// Prefill del Data Sheet desde un lote real del marketplace.
// Mapper puro (testeable); el fetch vive en la ruta del editor.

import { commodityLabel, formLabel, countryName } from "@/lib/commodityLabels";

/** Subconjunto del lote necesario para el data sheet (shape estructural). */
export type LotForDataSheet = {
  title: string;
  commodity: string;
  form: string;
  grade_pct: number | null;
  moisture_pct: number | null;
  tonnage_available_t: number | null;
  lot_size_t: number | null;
  frequency: string | null;
  country: string;
  region: string | null;
  port_of_loading: string | null;
  incoterm: string | null;
  price_basis: string | null;
  payment_terms: string | null;
  certifications_json: string[] | null;
  deleterious_json?: unknown;
};

function deleteriousText(d: unknown): string {
  if (Array.isArray(d) && d.length) return d.map(String).join(" · ");
  if (d && typeof d === "object") {
    const entries = Object.entries(d as Record<string, unknown>);
    if (entries.length) return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  }
  return "";
}

/**
 * Convierte un lote (+ score KYM opcional) en los valores iniciales del
 * template data-sheet. Solo llena lo que la fuente publica; el resto queda
 * vacío para que el vendedor lo complete.
 */
export function mapLotToDataSheetValues(
  lot: LotForDataSheet,
  opts: { sellerName?: string | null; kymScore?: number | null } = {},
): Record<string, string> {
  const values: Record<string, string> = {
    lotTitle: lot.title,
    product: commodityLabel(lot.commodity),
    form: formLabel(lot.form),
    grade: lot.grade_pct != null ? `${lot.grade_pct} %` : "",
    moisture: lot.moisture_pct != null ? String(lot.moisture_pct) : "",
    deleterious: deleteriousText(lot.deleterious_json),
    tonnage: lot.tonnage_available_t != null ? String(lot.tonnage_available_t) : "",
    lotSize: lot.lot_size_t != null ? String(lot.lot_size_t) : "",
    frequency: lot.frequency ?? "",
    origin: [countryName(lot.country), lot.region].filter(Boolean).join(" · "),
    port: lot.port_of_loading ?? "",
    incoterm: lot.incoterm ?? "",
    priceBasis: lot.price_basis ?? "",
    paymentTerms: lot.payment_terms ?? "",
    certifications: (lot.certifications_json ?? []).join(", "),
  };
  if (opts.sellerName) values.seller = opts.sellerName;
  if (opts.kymScore != null) values.kymScore = String(opts.kymScore);
  return values;
}
