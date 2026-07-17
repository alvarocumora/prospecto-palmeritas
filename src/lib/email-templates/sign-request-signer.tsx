/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles } from "./_shared";

interface Props {
  docTitle?: string;
  reference?: string;
  senderCompany?: string;
  signerName?: string;
  expiresAt?: string;
  /** Link único de firma (/firmar/$token) — viaja solo en este correo. */
  signUrl?: string;
}

const Email = ({ docTitle, reference, senderCompany, signerName, expiresAt, signUrl }: Props) => (
  <EmailLayout
    preview={`Documento para firma electrónica: ${docTitle ?? ""}`}
    ctaHref={signUrl}
    ctaLabel="Revisar y firmar"
  >
    <Heading style={styles.h1}>Tienes un documento para firmar</Heading>
    <Text style={styles.p}>
      {signerName ? `${signerName}: ` : ""}
      {senderCompany ?? "Una contraparte"} te envió un documento para firma electrónica a través de
      Geocapitals. Revísalo y fírmalo desde el enlace seguro — no necesitas cuenta.
    </Text>
    <KeyValueBlock
      rows={[
        ["Documento", docTitle],
        ["Referencia", reference],
        ["Remitente", senderCompany],
        ["Válido hasta", expiresAt],
      ]}
    />
    <Text style={styles.muted}>
      El enlace es personal e intransferible. Si no esperabas este documento, ignora este correo —
      nadie puede firmar sin este link.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Documento para firma: ${(d.docTitle as string) ?? "documento"}`,
  displayName: "Firmante · Solicitud de firma",
  previewData: {
    docTitle: "Acuerdo de Confidencialidad (NDA)",
    reference: "NDA-2026-001",
    senderCompany: "Asesorías Terra SpA",
    signerName: "María Pérez",
    expiresAt: "31 de julio de 2026",
    signUrl: "https://geocapitals.com/firmar/gcsign_ejemplo",
  },
} satisfies TemplateEntry;
