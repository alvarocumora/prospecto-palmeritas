/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  concessionsCount?: number;
  upcomingHa?: number;
  nextExpiry?: string;
  shareUrl?: string;
}

const Email = ({
  recipientName,
  projectName,
  concessionsCount,
  upcomingHa,
  nextExpiry,
  shareUrl,
}: Props) => (
  <EmailLayout
    preview={`Actualización de catastro · ${projectName ?? "tu proyecto"}`}
    audience="investor"
    ctaHref={shareUrl ?? appUrl("/inversionistas")}
    ctaLabel="Ver brief del proyecto"
  >
    <Heading style={styles.h1}>Estado de catastro — {projectName ?? "tu proyecto"}</Heading>
    <Text style={styles.p}>
      Estimado/a {recipientName ?? "inversionista"}, este es el resumen mensual del estado de
      catastro minero del proyecto. La pertenencia es la base legal del activo; mantenerla al día es
      prioritario.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Concesiones activas", concessionsCount],
        ["Superficie a renovar próx. 90 días", upcomingHa ? `${upcomingHa} ha` : "—"],
        ["Próximo vencimiento", nextExpiry],
      ]}
    />
    <Text style={styles.muted}>
      El equipo técnico tiene programadas las renovaciones y pagos de patente correspondientes.
      Recibirás un nuevo brief si cambia el estatus de algún título.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Catastro al día · ${d.projectName ?? "tu proyecto"}`,
  displayName: "Catastro · Brief inversionista",
  previewData: {
    recipientName: "Andrés",
    projectName: "Palmeras Cu-Au",
    concessionsCount: 14,
    upcomingHa: 1240,
    nextExpiry: "2026-08-31",
    shareUrl: "https://geocapitals.com/inversionistas/share/abcd",
  },
} satisfies TemplateEntry;
