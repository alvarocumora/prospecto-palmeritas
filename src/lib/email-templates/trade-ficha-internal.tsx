/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles } from "./_shared";

// Ficha pública de una operación enviada a la mesa de GeoCapitals.
// Solo contiene precio de VENTA y specs — nunca base, margen ni reparto interno.

interface Props {
  commodity?: string;
  reference?: string;
  productName?: string;
  presentation?: string;
  purity?: string;
  packaging?: string;
  origin?: string;
  incoterm?: string;
  quantity?: string;
  frequency?: string;
  contractMonths?: string | number;
  price?: string;
  operacionUrl?: string;
  fichaUrl?: string;
}

const Email = ({
  commodity,
  reference,
  productName,
  presentation,
  purity,
  packaging,
  origin,
  incoterm,
  quantity,
  frequency,
  contractMonths,
  price,
  operacionUrl,
  fichaUrl,
}: Props) => (
  <EmailLayout
    preview={`Ficha de operación · ${commodity ?? "Commodity"}${reference ? ` · ${reference}` : ""}`}
  >
    <Heading style={styles.h1}>Ficha de operación · {commodity ?? "Commodity"}</Heading>
    <Text style={styles.p}>
      Resumen comercial de la operación {reference ? <b>{reference}</b> : null}. Contiene únicamente
      condiciones públicas de venta y especificaciones del producto.
    </Text>

    <KeyValueBlock
      rows={[
        ["Referencia", reference],
        ["Commodity", commodity],
        ["Producto", productName],
        ["Presentación", presentation],
        ["Pureza / ley", purity],
        ["Envase", packaging],
        ["Procedencia", origin],
        ["Incoterm", incoterm],
        ["Cantidad por pedido", quantity],
        ["Frecuencia", frequency],
        ["Contrato (meses)", contractMonths ? String(contractMonths) : undefined],
        ["Precio de venta", price],
      ]}
    />

    {operacionUrl ? (
      <Text style={styles.p}>
        Sala de operación: <a href={operacionUrl}>{operacionUrl}</a>
      </Text>
    ) : null}
    {fichaUrl ? (
      <Text style={styles.p}>
        Ficha pública: <a href={fichaUrl}>{fichaUrl}</a>
      </Text>
    ) : null}

    <Hr style={styles.hr} />
    <Text style={styles.muted}>
      Geocapitals · info@geocapitals.com · WhatsApp +56 9 6218 4071. Documento comercial preliminar,
      no constituye oferta vinculante.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Ficha de operación${d.commodity ? ` — ${String(d.commodity)}` : ""}${
      d.reference ? ` · ${String(d.reference)}` : ""
    }`,
  displayName: "Trades · Ficha de operación (interno)",
  previewData: {
    commodity: "Gold",
    reference: "GC-AU-0001",
    productName: "Oro doré",
    presentation: "Doré",
    purity: "92-94%",
    quantity: "5.000 g",
    price: "$ 117.000 / g",
    operacionUrl: "https://geocapitals.com/operacion/demo",
  },
} satisfies TemplateEntry;
