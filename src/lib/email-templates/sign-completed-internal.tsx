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
  ownerEmail?: string;
  dealReference?: string;
}

const Email = ({
  docTitle,
  reference,
  signedByName,
  signedAt,
  ownerEmail,
  dealReference,
}: Props) => (
  <EmailLayout
    preview={`Firma registrada: ${docTitle ?? ""}`}
    ctaHref={appUrl("/dashboard/trades")}
    ctaLabel="Ver operación"
  >
    <Heading style={styles.h1}>
      Firma registrada en una operación {badge("success", "FIRMADO")}
    </Heading>
    <Text style={styles.p}>
      {signedByName ?? "Una contraparte"} firmó electrónicamente un documento gestionado por
      Geocapitals. La firma quedó sellada con hash de integridad y el registro completo está en la
      plataforma.
    </Text>
    <KeyValueBlock
      rows={(
        [
          ["Documento", docTitle],
          ["Referencia", reference],
          ["Operación", dealReference],
          ["Firmado por", signedByName],
          ["Fecha", signedAt],
          ["Dueño de la solicitud", ownerEmail],
        ] as Array<[string, string | undefined]>
      ).filter(([, v]) => v != null && v !== "")}
    />
    <Text style={styles.muted}>
      Copia interna para la bandeja de operaciones de Geocapitals · trazabilidad del deal.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Firma registrada: ${(d.docTitle as string) ?? "documento"}`,
  displayName: "Interno · Firma registrada (operaciones)",
  to: "team@geocapitals.com",
  previewData: {
    docTitle: "Acuerdo de Confidencialidad (NDA)",
    reference: "NDA-2026-001",
    dealReference: "SB-ANTIMONIO-202607-4434",
    signedByName: "María Pérez",
    signedAt: "17 de julio de 2026, 14:32",
    ownerEmail: "alvaro@geocapitals.com",
  },
} satisfies TemplateEntry;
