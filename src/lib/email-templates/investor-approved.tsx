/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  fullName?: string;
  reviewerName?: string;
  notes?: string;
}

const Email = ({ fullName, reviewerName, notes }: Props) => (
  <EmailLayout
    preview="Tu acceso institucional está activo"
    audience="investor"
    ctaHref={appUrl("/dashboard")}
    ctaLabel="Ver oportunidades"
  >
    <Heading style={styles.h1}>Acceso aprobado · Bienvenido, {fullName ?? ""}</Heading>
    <Text style={styles.p}>
      Tu perfil fue verificado por {reviewerName ?? "el equipo de Geocapitals"}. Ya puedes:
    </Text>
    <Text style={styles.p}>
      · Solicitar acceso a data rooms NI 43-101.<br />
      · Firmar NDA click-wrap por proyecto.<br />
      · Recibir alertas de nuevas oportunidades alineadas a tu ticket y commodities.<br />
      · Coordinar reuniones con titulares mineros calificados.
    </Text>
    <KeyValueBlock
      rows={[
        ["Estado", "Aprobado"],
        ["Revisado por", reviewerName ?? "Equipo Geocapitals"],
        ["Notas", notes],
      ]}
    />
    <Text style={styles.muted}>
      Para cerrar una transacción, Geocapitals emite factura de éxito post-cierre. Si te interesa
      un proyecto en particular, responde a este correo o usa el formulario en el dashboard.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: "Geocapitals · Acceso institucional aprobado",
  displayName: "Inversionista · Aprobado",
  previewData: {
    fullName: "María Rodríguez",
    reviewerName: "Andrés Pérez",
    notes: "Ticket validado, KYC completo.",
  },
} satisfies TemplateEntry;
