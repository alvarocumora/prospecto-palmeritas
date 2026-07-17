/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, badge, styles } from "./_shared";

interface Props {
  supplierName?: string;
  reference?: string;
  commodity?: string;
  tradeReference?: string;
  senderCompany?: string;
}

const Email = ({ supplierName, reference, commodity, tradeReference, senderCompany }: Props) => (
  <EmailLayout preview={`Tu propuesta avanzó a una operación formal · ${reference ?? ""}`}>
    <Heading style={styles.h1}>Tu propuesta avanzó {badge("success", "SELECCIONADA")}</Heading>
    <Text style={styles.p}>
      {supplierName ? `${supplierName}: ` : ""}
      {senderCompany ?? "Geocapitals"} seleccionó tu propuesta para el requerimiento{" "}
      <strong>{reference ?? ""}</strong> y la convirtió en una operación formal. El equipo te
      contactará para avanzar con los documentos (NDA, data sheet, contrato) y los siguientes pasos.
    </Text>
    <KeyValueBlock
      rows={[
        ["Requerimiento", reference],
        ["Commodity", commodity],
        ["Operación", tradeReference],
      ]}
    />
    <Text style={styles.muted}>
      No necesitas hacer nada por ahora. Responde este correo si tienes documentación adicional que
      aportar.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Tu propuesta avanzó a operación${d.reference ? ` · ${d.reference}` : ""}`,
  displayName: "Sourcing · Propuesta convertida (proveedor)",
  previewData: {
    supplierName: "Minera Andes",
    reference: "RFQ-COBRE-01",
    commodity: "Concentrado de cobre",
    tradeReference: "RFQ-COBRE-01 · Minera Andes",
    senderCompany: "Asesorías Terra SpA",
  },
} satisfies TemplateEntry;
