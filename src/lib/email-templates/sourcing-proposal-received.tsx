/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  reference?: string;
  commodity?: string;
  supplierName?: string;
  supplierCompany?: string;
  offerPrice?: string;
  offerQuantity?: string;
}

const Email = ({
  reference,
  commodity,
  supplierName,
  supplierCompany,
  offerPrice,
  offerQuantity,
}: Props) => (
  <EmailLayout
    preview={`Nueva propuesta de proveedor para ${reference ?? "tu requerimiento"}`}
    ctaHref={appUrl("/dashboard/sourcing")}
    ctaLabel="Ver propuestas"
  >
    <Heading style={styles.h1}>Nueva propuesta de proveedor</Heading>
    <Text style={styles.p}>
      {supplierName ?? "Un proveedor"}
      {supplierCompany ? ` (${supplierCompany})` : ""} envió una propuesta a tu requerimiento{" "}
      <strong>{reference ?? ""}</strong>. Revísala, preselecciónala y, cuando avances, conviértela
      en una operación del Trade Desk.
    </Text>
    <KeyValueBlock
      rows={[
        ["Requerimiento", reference],
        ["Commodity", commodity],
        ["Proveedor", supplierName],
        ["Empresa", supplierCompany],
        ["Precio ofertado", offerPrice],
        ["Cantidad", offerQuantity],
      ]}
    />
    <Text style={styles.muted}>
      La propuesta y sus documentos (data sheet, procedencia, certificados) viven en la plataforma.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Nueva propuesta para ${(d.reference as string) ?? "tu requerimiento"}`,
  displayName: "Sourcing · Propuesta recibida",
  previewData: {
    reference: "RFQ-COBRE-01",
    commodity: "Concentrado de cobre",
    supplierName: "Minera Andes",
    supplierCompany: "Andes SpA",
    offerPrice: "US$ 8.200/t",
    offerQuantity: "5.000 t",
  },
} satisfies TemplateEntry;
