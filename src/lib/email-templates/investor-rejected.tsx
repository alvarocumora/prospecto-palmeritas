/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, appUrl, styles } from "./_shared";

interface Props {
  fullName?: string;
  reason?: string;
}

const Email = (p: Props) => (
  <EmailLayout
    preview="Actualización sobre tu verificación de inversionista"
    audience="investor"
    ctaHref={appUrl("/contacto")}
    ctaLabel="Hablar con el equipo"
  >
    <Heading style={styles.h1}>No pudimos aprobar tu perfil por ahora</Heading>
    <Text style={styles.p}>
      Hola{p.fullName ? ` ${p.fullName}` : ""}: revisamos tu perfil de inversionista y no pudimos
      aprobarlo con la información disponible.
    </Text>
    {p.reason && (
      <Text style={styles.p}>
        <strong>Motivo:</strong> {p.reason}
      </Text>
    )}
    <Text style={styles.p}>
      Esto no es necesariamente definitivo — en la mayoría de los casos falta documentación de
      respaldo o información de la entidad. Si crees que es un error o quieres completar tu
      verificación, escríbenos y te guiamos en el proceso.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: "Tu verificación de inversionista — Geocapitals",
  displayName: "Inversionista · Perfil rechazado",
  previewData: {
    fullName: "María Rodríguez",
    reason: "Falta documentación de respaldo de la entidad inversora.",
  },
} satisfies TemplateEntry;
