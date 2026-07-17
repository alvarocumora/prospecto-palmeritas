/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, badge, styles } from "./_shared";

interface Props {
  docTitle?: string;
  reference?: string;
  signedByName?: string;
  signedAt?: string;
}

const Email = ({ docTitle, reference, signedByName, signedAt }: Props) => (
  <EmailLayout
    preview={`Documento firmado: ${docTitle ?? ""}`}
    ctaHref={appUrl("/dashboard/documentos")}
    ctaLabel="Ver mis documentos"
  >
    <Heading style={styles.h1}>Tu documento fue firmado {badge("success", "FIRMADO")}</Heading>
    <Text style={styles.p}>
      {signedByName ?? "La contraparte"} firmó electrónicamente el documento que enviaste. La firma
      quedó sellada con hash de integridad y el registro completo está en la plataforma.
    </Text>
    <KeyValueBlock
      rows={[
        ["Documento", docTitle],
        ["Referencia", reference],
        ["Firmado por", signedByName],
        ["Fecha", signedAt],
      ]}
    />
    <Text style={styles.muted}>
      Puedes descargar el PDF con la constancia de firma desde el editor de documentos.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Documento firmado: ${(d.docTitle as string) ?? "documento"}`,
  displayName: "Dueño · Documento firmado",
  previewData: {
    docTitle: "Acuerdo de Confidencialidad (NDA)",
    reference: "NDA-2026-001",
    signedByName: "María Pérez",
    signedAt: "17 de julio de 2026, 14:32",
  },
} satisfies TemplateEntry;
