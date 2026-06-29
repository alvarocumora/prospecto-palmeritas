/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  fullName?: string;
  companyName?: string;
  email?: string;
  country?: string;
  investorType?: string;
  ticketRange?: string;
  commodities?: string;
  standards?: string;
  website?: string;
}

const Email = (p: Props) => (
  <EmailLayout
    preview={`Nuevo lead inversionista: ${p.fullName ?? p.email ?? ""}`}
    audience="internal"
    ctaHref={appUrl("/dashboard/admin/investors")}
    ctaLabel="Revisar en admin"
  >
    <Heading style={styles.h1}>Nuevo inversionista en revisión</Heading>
    <Text style={styles.p}>
      Un nuevo perfil completó el onboarding y está pendiente de aprobación KYC/AML.
    </Text>
    <KeyValueBlock
      rows={[
        ["Nombre", p.fullName],
        ["Empresa / Fondo", p.companyName],
        ["Email", p.email],
        ["País", p.country],
        ["Tipo", p.investorType],
        ["Ticket", p.ticketRange],
        ["Commodities", p.commodities],
        ["Estándares", p.standards],
        ["Website", p.website],
      ]}
    />
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Lead inversionista: ${d.fullName ?? d.email ?? "(sin nombre)"}`,
  displayName: "Interno · Nuevo lead inversionista",
  to: "team@geocapitals.com",
  previewData: {
    fullName: "María Rodríguez",
    companyName: "Andes Capital",
    email: "maria@andescapital.cl",
    country: "Chile",
    investorType: "fund",
    ticketRange: "USD 1M – 5M",
    commodities: "Au, Cu",
    standards: "NI 43-101",
    website: "https://andescapital.cl",
  },
} satisfies TemplateEntry;
