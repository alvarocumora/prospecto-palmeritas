import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  inviterName?: string;
  projectName?: string;
  organization?: string;
  shareUrl?: string;
  expiresAt?: string;
}

const Email = ({ inviterName, projectName, organization, shareUrl, expiresAt }: Props) => (
  <EmailLayout
    preview={`Acceso al data room de ${projectName ?? ""}`}
    audience="investor"
    ctaHref={shareUrl ?? appUrl("/inversionistas")}
    ctaLabel="Abrir data room"
  >
    <Heading style={styles.h1}>Acceso al data room — {projectName ?? ""}</Heading>
    <Text style={styles.p}>
      {inviterName ?? "El equipo"} de {organization ?? "Geocapitals"} te invita a revisar la
      documentación del proyecto: brief ejecutivo, NI 43-101, mapas, modelos 3D y deal terms.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Compañía", organization],
        ["Acceso válido hasta", expiresAt],
      ]}
    />
    <Text style={styles.muted}>
      Este enlace es personal e intransferible y queda registrado en el log de acceso del data
      room. Para más información, responde a este correo.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Acceso al data room de ${d.projectName ?? "tu proyecto"}`,
  displayName: "Proyecto · Invitación inversionista",
  previewData: {
    inviterName: "Andrés Pérez",
    projectName: "Palmeras Cu-Au",
    organization: "Geocapitals",
    shareUrl: "https://geocapitals.com/inversionistas/share/abcd",
    expiresAt: "2026-07-30",
  },
} satisfies TemplateEntry;
