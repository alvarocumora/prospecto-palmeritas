/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  lotTitle?: string;
  /** "status" (avance de cotización) o "message" (nuevo mensaje del seller). */
  kind?: "status" | "message";
  statusLabel?: string;
  messagePreview?: string;
}

const Email = ({ lotTitle, kind, statusLabel, messagePreview }: Props) => (
  <EmailLayout
    preview={
      kind === "message"
        ? `Nuevo mensaje del seller sobre ${lotTitle ?? "tu cotización"}`
        : `Tu cotización avanzó: ${statusLabel ?? ""}`
    }
    audience="investor"
    ctaHref={appUrl("/dashboard/my-inquiries")}
    ctaLabel="Ver mis cotizaciones"
  >
    <Heading style={styles.h1}>
      {kind === "message" ? "Nuevo mensaje del seller" : "Tu cotización avanzó"}
    </Heading>
    <Text style={styles.p}>
      {kind === "message"
        ? `El seller respondió sobre el lote "${lotTitle ?? ""}".`
        : `El estado de tu consulta por "${lotTitle ?? ""}" cambió.`}
    </Text>
    <KeyValueBlock
      rows={[
        ["Lote", lotTitle],
        kind === "message" ? ["Mensaje", messagePreview] : ["Nuevo estado", statusLabel],
      ]}
    />
    <Text style={styles.muted}>
      Responde desde tu bandeja de cotizaciones — la conversación completa y el avance de la
      negociación viven en la plataforma.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d.kind === "message"
      ? `Geocapitals · Nuevo mensaje sobre ${(d.lotTitle as string) ?? "tu cotización"}`
      : `Geocapitals · Tu cotización avanzó: ${(d.statusLabel as string) ?? ""}`,
  displayName: "Buyer · Avance de cotización",
  previewData: {
    lotTitle: "Concentrado de cobre 28% Cu — Puerto Angamos",
    kind: "status",
    statusLabel: "Oferta enviada",
    messagePreview: "",
  },
} satisfies TemplateEntry;
