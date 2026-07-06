/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  fullName?: string;
  companyName?: string;
  ticketRange?: string;
  commodities?: string;
}

const Email = ({ fullName, companyName, ticketRange, commodities }: Props) => (
  <EmailLayout
    preview="Tu solicitud de acceso institucional fue recibida"
    audience="investor"
    ctaHref={appUrl("/dashboard")}
    ctaLabel="Ir a mi dashboard"
  >
    <Heading style={styles.h1}>Bienvenido a Geocapitals, {fullName ?? "inversionista"}</Heading>
    <Text style={styles.p}>
      Recibimos tu perfil. Nuestro equipo está revisando tu información KYC/AML y te confirmaremos
      el acceso institucional en menos de 48 horas hábiles.
    </Text>
    <KeyValueBlock
      rows={[
        ["Nombre", fullName],
        ["Empresa / Fondo", companyName],
        ["Ticket objetivo", ticketRange],
        ["Commodities de interés", commodities],
        ["Estado", "En revisión"],
      ]}
    />
    <Text style={styles.muted}>
      Mientras tanto puedes explorar el dashboard público, ver el deal-flow activo y conocer las
      oportunidades verificadas (NI 43-101, JORC). Si necesitas hablar con alguien antes, responde
      directamente a este correo.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: "Geocapitals · Solicitud de acceso institucional recibida",
  displayName: "Inversionista · Bienvenida (en revisión)",
  previewData: {
    fullName: "María Rodríguez",
    companyName: "Andes Capital",
    ticketRange: "USD 1M – 5M",
    commodities: "Au, Cu",
  },
} satisfies TemplateEntry;
