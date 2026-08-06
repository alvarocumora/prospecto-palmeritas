/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, styles } from "./_shared";

// Código de un solo uso para abrir el panel privado de una operación.

interface Props {
  code?: string;
  reference?: string;
  minutes?: number;
}

const Email = ({ code, reference, minutes = 15 }: Props) => (
  <EmailLayout preview={`Código de acceso al panel de la operación${reference ? ` ${reference}` : ""}`}>
    <Heading style={styles.h1}>Código de acceso</Heading>
    <Text style={styles.p}>
      Usa este código para abrir el panel privado de la operación
      {reference ? ` ${reference}` : ""}. Vence en {minutes} minutos y sirve una sola vez.
    </Text>

    <Text
      style={{
        ...styles.h1,
        letterSpacing: "10px",
        textAlign: "center" as const,
        margin: "24px 0",
      }}
    >
      {code ?? "------"}
    </Text>

    <Hr style={styles.hr} />
    <Text style={styles.muted}>
      Si no solicitaste este acceso, ignora este correo y avísanos a info@geocapitals.com.
      Geocapitals · WhatsApp +56 9 6218 4071.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Código de acceso${d.reference ? ` ${String(d.reference)}` : ""}`,
  displayName: "Portal · Código de acceso",
  previewData: { code: "482913", reference: "AU-DORE-202607-CKG", minutes: 15 },
} satisfies TemplateEntry;
