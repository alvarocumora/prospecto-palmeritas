import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  reportTitle?: string;
  reportType?: string;
  leadQp?: string;
  signatureDate?: string;
  shareUrl?: string;
}

const Email = ({
  recipientName,
  projectName,
  reportTitle,
  reportType,
  leadQp,
  signatureDate,
  shareUrl,
}: Props) => (
  <EmailLayout
    preview={`Nuevo reporte ${reportType?.toUpperCase() ?? ""} disponible · ${projectName ?? ""}`}
    audience="investor"
    ctaHref={shareUrl ?? appUrl("/inversionistas")}
    ctaLabel="Descargar reporte"
  >
    <Heading style={styles.h1}>
      Reporte {reportType?.toUpperCase() ?? ""} firmado — {projectName ?? ""}
    </Heading>
    <Text style={styles.p}>
      Estimado/a {recipientName ?? "inversionista"}, el reporte técnico del proyecto fue firmado
      por la Persona Calificada (QP) y está disponible para tu revisión. Cumple con los estándares
      regulatorios aplicables y respalda la valoración del activo.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Reporte", reportTitle],
        ["Estándar", reportType],
        ["QP firmante", leadQp],
        ["Fecha de firma", signatureDate],
      ]}
    />
    <Text style={styles.muted}>
      El reporte está cifrado y el acceso queda registrado en el data room.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) =>
    `Nuevo reporte ${d.reportType?.toUpperCase() ?? "NI 43-101"} firmado · ${d.projectName ?? ""}`,
  displayName: "Reporte técnico · Brief inversionista",
  previewData: {
    recipientName: "Andrés",
    projectName: "Palmeras Cu-Au",
    reportTitle: "Technical Report 2026 Q2",
    reportType: "ni43101",
    leadQp: "Ing. C. Soto · MAusIMM",
    signatureDate: "2026-06-14",
  },
} satisfies TemplateEntry;
