// Agente redactor de term sheet: arma un borrador de condiciones comerciales a
// partir del lote, la consulta del comprador y el valor pagable estimado.
// Determinista y testeable; el server fn agrega precios en vivo y un resumen IA.

export type TermSheetInput = {
  ref: string;
  sellerName: string;
  buyerName: string;
  lotTitle: string;
  commodityLabel: string;
  formLabel: string;
  gradePct: number | null;
  moisturePct: number | null;
  deleterious: Record<string, number>;
  tonnageT: number | null;
  targetVolumeT: number | null;
  incoterm: string | null;
  portOfLoading: string | null;
  country: string | null;
  priceBasis: string | null;
  premiumDiscountUsdT: number | null;
  paymentTerms: string | null;
  netUsdT: number | null; // valor pagable estimado (agente Assay-to-Value)
  band: { low: number; high: number } | null;
};

export type TermSheetField = { label: string; value: string };
export type TermSheetSection = { heading: string; fields: TermSheetField[] };
export type TermSheet = {
  title: string;
  ref: string;
  sections: TermSheetSection[];
  notes: string[];
};

function usd(v: number | null, frac = 0): string {
  return v == null ? "—" : `US$ ${v.toLocaleString("en-US", { maximumFractionDigits: frac })}`;
}
function pct(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}
function t(v: number | null): string {
  return v == null ? "—" : `${v.toLocaleString("es-CL")} t`;
}

/** Construye el term sheet estructurado. */
export function buildTermSheet(i: TermSheetInput): TermSheet {
  const volume = i.targetVolumeT ?? i.tonnageT;
  const deleteriousStr =
    Object.keys(i.deleterious).length > 0
      ? Object.entries(i.deleterious)
          .map(([k, v]) => `${k} ${v}%`)
          .join(", ")
      : "Según certificado de ensaye";

  const priceFormula = i.priceBasis
    ? i.priceBasis
    : "Referencia BML (LME) del mes de embarque, menos cargos de tratamiento y refinación (TC/RC) y castigos por impurezas.";

  const sections: TermSheetSection[] = [
    {
      heading: "1. Partes",
      fields: [
        { label: "Vendedor", value: i.sellerName },
        { label: "Comprador", value: i.buyerName },
      ],
    },
    {
      heading: "2. Producto y calidad",
      fields: [
        { label: "Producto", value: `${i.commodityLabel} (${i.formLabel})` },
        { label: "Lote", value: i.lotTitle },
        { label: "Ley", value: pct(i.gradePct) },
        { label: "Humedad", value: pct(i.moisturePct) },
        { label: "Elementos penalizables", value: deleteriousStr },
      ],
    },
    {
      heading: "3. Cantidad",
      fields: [
        { label: "Cantidad", value: t(volume) },
        { label: "Disponibilidad total", value: t(i.tonnageT) },
      ],
    },
    {
      heading: "4. Precio y fórmula",
      fields: [
        { label: "Fórmula de precio", value: priceFormula },
        {
          label: "Premio / descuento",
          value:
            i.premiumDiscountUsdT != null
              ? `${i.premiumDiscountUsdT > 0 ? "+" : ""}${usd(i.premiumDiscountUsdT)}/t`
              : "—",
        },
        {
          label: "Valor pagable estimado",
          value: i.netUsdT != null ? `${usd(i.netUsdT)}/t (referencial)` : "—",
        },
        {
          label: "Rango de referencia",
          value: i.band ? `${usd(i.band.low)}–${usd(i.band.high)}/t` : "—",
        },
      ],
    },
    {
      heading: "5. Entrega",
      fields: [
        { label: "Incoterm", value: i.incoterm ?? "Por acordar" },
        { label: "Puerto de embarque", value: i.portOfLoading ?? "—" },
        { label: "Origen", value: i.country ?? "—" },
      ],
    },
    {
      heading: "6. Pago",
      fields: [
        {
          label: "Condiciones de pago",
          value: i.paymentTerms ?? "Carta de crédito / pago provisional 90% contra documentos.",
        },
      ],
    },
  ];

  return {
    title: `Term Sheet — ${i.lotTitle}`,
    ref: i.ref,
    sections,
    notes: [
      "Borrador referencial no vinculante, sujeto a due diligence, muestra y contrato definitivo.",
      "El valor pagable estimado usa precios de mercado en vivo y términos benchmark; no constituye oferta.",
    ],
  };
}

/** Serializa el term sheet a Markdown. */
export function termSheetToMarkdown(ts: TermSheet): string {
  const lines: string[] = [`# ${ts.title}`, "", `**Referencia:** ${ts.ref}`, ""];
  for (const s of ts.sections) {
    lines.push(`## ${s.heading}`, "");
    for (const f of s.fields) lines.push(`- **${f.label}:** ${f.value}`);
    lines.push("");
  }
  if (ts.notes.length) {
    lines.push("---", "");
    for (const n of ts.notes) lines.push(`> ${n}`);
  }
  return lines.join("\n");
}
