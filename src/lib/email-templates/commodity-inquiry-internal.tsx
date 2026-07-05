/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  lotTitle?: string;
  lotId?: string;
  buyerEmail?: string;
  companyName?: string;
  buyerRole?: string;
  targetVolume?: string;
  targetPrice?: string;
  intendedUse?: string;
  message?: string;
}

const Email = (p: Props) => (
  <EmailLayout
    preview={`Nueva consulta de lote: ${p.lotTitle ?? p.lotId ?? ""}`}
    audience="internal"
    ctaHref={appUrl("/dashboard/admin/inbox")}
    ctaLabel="Abrir bandeja de entrada"
  >
    <Heading style={styles.h1}>Nueva consulta en el marketplace</Heading>
    <Text style={styles.p}>
      Un comprador registró interés en un lote de commodities. La UI le prometió que el seller lo
      contactará — este email existe para que esa promesa se cumpla.
    </Text>
    <KeyValueBlock
      rows={[
        ["Lote", p.lotTitle],
        ["Comprador", p.buyerEmail],
        ["Empresa", p.companyName],
        ["Rol", p.buyerRole],
        ["Volumen objetivo", p.targetVolume],
        ["Precio objetivo", p.targetPrice],
        ["Uso previsto", p.intendedUse],
        ["Mensaje", p.message],
      ]}
    />
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Consulta marketplace: ${d.lotTitle ?? d.lotId ?? "(lote)"}`,
  displayName: "Interno · Consulta de lote commodity",
  to: "team@geocapitals.com",
  previewData: {
    lotTitle: "Concentrado Cu 28% · 500 t",
    buyerEmail: "trader@metalsco.com",
    companyName: "MetalsCo Trading",
    buyerRole: "trader",
    targetVolume: "500 t/mes",
    targetPrice: "US$ 8.200/t",
    intendedUse: "Refinación",
    message: "Interesados en contrato anual con entrega CIF Shanghái.",
  },
} satisfies TemplateEntry;
