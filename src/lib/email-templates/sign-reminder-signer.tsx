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
  hoursRemaining?: number;
  reminderNumber?: number;
  signUrl?: string;
}

const Email = ({
  docTitle,
  reference,
  senderCompany,
  signerName,
  expiresAt,
  hoursRemaining,
  reminderNumber,
  signUrl,
}: Props) => {
  const urgent = typeof hoursRemaining === "number" && hoursRemaining <= 48;
  return (
    <EmailLayout
      preview={`Recordatorio de firma pendiente: ${docTitle ?? ""}`}
      ctaHref={signUrl}
      ctaLabel="Firmar ahora"
    >
      <Heading style={styles.h1}>
        {urgent ? "Tu firma vence pronto" : "Recordatorio: firma pendiente"}
      </Heading>
      <Text style={styles.p}>
        {signerName ? `${signerName}: ` : ""}
        aún no completas la firma electrónica del documento enviado por{" "}
        {senderCompany ?? "la contraparte"}. Este es el recordatorio{" "}
        {reminderNumber ?? 1} · el flujo queda anulado si expira la vigencia.
      </Text>
      <KeyValueBlock
        rows={[
          ["Documento", docTitle],
          ["Referencia", reference],
          ["Remitente", senderCompany],
          ["Vence", expiresAt],
          [
            "Tiempo restante",
            typeof hoursRemaining === "number"
              ? hoursRemaining >= 48
                ? `${Math.round(hoursRemaining / 24)} días`
                : `${hoursRemaining} horas`
              : undefined,
          ],
        ]}
      />
      <Text style={styles.muted}>
        Firma desde el enlace seguro — es personal e intransferible. Si ya no aplica, ignora este
        correo y coordina con la contraparte para anular el flujo.
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const h = d.hoursRemaining as number | undefined;
    const urgent = typeof h === "number" && h <= 48;
    return `Geocapitals · ${urgent ? "Vence pronto" : "Recordatorio"}: firma pendiente ${
      (d.docTitle as string) ?? ""
    }`.trim();
  },
  displayName: "Firmante · Recordatorio de firma",
  previewData: {
    docTitle: "NCNDA — SingularX / ZBALA / Geocapitals",
    reference: "NCNDA-2026-014",
    senderCompany: "Geocapitals",
    signerName: "Joaquín Belmar",
    expiresAt: "31 de julio de 2026",
    hoursRemaining: 36,
    reminderNumber: 2,
    signUrl: "https://geocapitals.com/firmar/operacion/gcsign_ejemplo",
  },
} satisfies TemplateEntry;
