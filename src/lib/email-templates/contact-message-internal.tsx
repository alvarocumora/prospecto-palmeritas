/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  name?: string;
  email?: string;
  organization?: string;
  role?: string;
  source?: string;
  message?: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño de proyecto",
  investor: "Inversionista",
  qp: "Qualified Person",
  other: "Otro",
};

const Email = (p: Props) => (
  <EmailLayout
    preview={`Nuevo mensaje de contacto: ${p.name ?? p.email ?? ""}`}
    audience="internal"
    ctaHref={appUrl("/dashboard/admin/inbox")}
    ctaLabel="Abrir bandeja de entrada"
  >
    <Heading style={styles.h1}>Nuevo mensaje de contacto</Heading>
    <Text style={styles.p}>
      Alguien escribió desde la web pública. Cada lead responde a un dueño de proyecto o
      inversionista potencial — responder rápido es parte del embudo.
    </Text>
    <KeyValueBlock
      rows={[
        ["Nombre", p.name],
        ["Email", p.email],
        ["Organización", p.organization],
        ["Perfil", ROLE_LABEL[p.role ?? ""] ?? p.role],
        ["Origen", p.source],
        ["Mensaje", p.message],
      ]}
    />
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Contacto web: ${d.name ?? d.email ?? "(sin nombre)"}`,
  displayName: "Interno · Mensaje de contacto",
  to: "team@geocapitals.com",
  previewData: {
    name: "Juan Pérez",
    email: "juan@mineraejemplo.cl",
    organization: "Minera Ejemplo SpA",
    role: "owner",
    source: "landing",
    message: "Quiero listar mi proyecto de cobre en Atacama para levantar capital.",
  },
} satisfies TemplateEntry;
