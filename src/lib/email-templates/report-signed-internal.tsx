/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, badge, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  reportTitle?: string;
  reportType?: string;
  status?: string;
  leadQp?: string;
  complianceScore?: number;
  signatureDate?: string;
  reportId?: string;
}

const Email = ({
  recipientName,
  projectName,
  reportTitle,
  reportType,
  status,
  leadQp,
  complianceScore,
  signatureDate,
  reportId,
}: Props) => (
  <EmailLayout
    preview={`Reporte ${reportTitle ?? ""} ${status === "signed" ? "firmado" : status}`}
    audience="internal"
    ctaHref={appUrl(`/dashboard/ni43101${reportId ? `?report=${reportId}` : ""}`)}
    ctaLabel="Abrir reporte"
  >
    <Heading style={styles.h1}>
      {badge("success", status === "signed" ? "FIRMADO" : (status ?? "").toUpperCase())}{" "}
      <span style={{ marginLeft: 6 }}>{reportTitle ?? "Reporte técnico"}</span>
    </Heading>
    <Text style={styles.p}>
      Hola{recipientName ? ` ${recipientName}` : ""}, el reporte técnico del proyecto{" "}
      <strong>{projectName ?? "—"}</strong> cambió de estado. Revisa el detalle y comparte con QPs o
      stakeholders según corresponda.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Reporte", reportTitle],
        ["Tipo", reportType],
        ["Estado", status],
        ["QP líder", leadQp],
        ["Compliance", complianceScore ? `${complianceScore}%` : "—"],
        ["Firmado", signatureDate],
      ]}
    />
    <Text style={styles.muted}>
      Los reportes firmados quedan inmutables en la línea de versiones y reproducibles desde el
      módulo NI 43-101.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) =>
    `[${d.reportType?.toUpperCase() ?? "NI43101"}] ${d.reportTitle ?? "Reporte"} firmado · ${d.projectName ?? ""}`,
  displayName: "Reporte técnico · Firmado (interno)",
  previewData: {
    recipientName: "Equipo",
    projectName: "Palmeras Cu-Au",
    reportTitle: "Technical Report 2026 Q2",
    reportType: "ni43101",
    status: "signed",
    leadQp: "Ing. C. Soto · MAusIMM",
    complianceScore: 97,
    signatureDate: "2026-06-14",
  },
} satisfies TemplateEntry;
