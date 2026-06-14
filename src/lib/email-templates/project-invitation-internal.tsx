/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  inviterName?: string;
  projectName?: string;
  projectCode?: string;
  role?: string;
  token?: string;
  expiresAt?: string;
}

const Email = ({ inviterName, projectName, projectCode, role, token, expiresAt }: Props) => (
  <EmailLayout
    preview={`Invitación al proyecto ${projectName ?? projectCode ?? ""}`}
    audience="internal"
    ctaHref={appUrl(`/auth/invitation${token ? `?token=${token}` : ""}`)}
    ctaLabel="Aceptar invitación"
  >
    <Heading style={styles.h1}>Te invitaron a colaborar en {projectName ?? projectCode}</Heading>
    <Text style={styles.p}>
      {inviterName ?? "Un colega"} te invitó a sumarte al proyecto en Geocapitals con el rol
      asignado más abajo. Tendrás acceso a catastro, satelital, sondajes y reportes técnicos según
      tus permisos.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Código", projectCode],
        ["Rol", role],
        ["Invitación válida hasta", expiresAt],
      ]}
    />
    <Text style={styles.muted}>
      Si no esperabas esta invitación, ignora este correo: tu cuenta no será modificada.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Invitación al proyecto ${d.projectName ?? d.projectCode ?? ""}`,
  displayName: "Proyecto · Invitación equipo",
  previewData: {
    inviterName: "Camila Soto",
    projectName: "Palmeras Cu-Au",
    projectCode: "PALM-01",
    role: "geologist",
    token: "demo_token_123",
    expiresAt: "2026-06-30",
  },
} satisfies TemplateEntry;
