/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Hr, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles } from "./_shared";

// Invitación privada a un participante de una operación (bróker, asesor,
// comprador, vendedor u observador). Contiene su enlace personal de acceso.

interface Props {
  name?: string;
  company?: string;
  role?: string;
  commodity?: string;
  reference?: string;
  accessUrl?: string;
}

const Email = ({ name, company, role, commodity, reference, accessUrl }: Props) => (
  <EmailLayout preview={`Acceso a la operación${reference ? ` ${reference}` : ""} · Geocapitals`}>
    <Heading style={styles.h1}>Acceso a la operación</Heading>
    <Text style={styles.p}>
      {name ? `${name}, ` : ""}te invitamos a participar en una operación intermediada por
      Geocapitals{commodity ? ` de ${commodity}` : ""}. Tu enlace es personal e intransferible y
      puede revocarse en cualquier momento.
    </Text>

    <KeyValueBlock
      rows={[
        ["Referencia", reference],
        ["Commodity", commodity],
        ["Rol asignado", role],
        ["Empresa", company],
      ]}
    />

    {accessUrl ? (
      <>
        <Button href={accessUrl} style={styles.button}>
          Abrir la operación
        </Button>
        <Text style={styles.muted}>{accessUrl}</Text>
      </>
    ) : null}

    <Hr style={styles.hr} />
    <Text style={styles.muted}>
      Geocapitals · info@geocapitals.com · WhatsApp +56 9 6218 4071. Si no esperabas este correo,
      ignóralo: el enlace no otorga acceso a información interna de precios ni comisiones.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Acceso a la operación${d.reference ? ` ${String(d.reference)}` : ""}`,
  displayName: "Trades · Invitación de participante",
  previewData: {
    name: "Joaquín Belmar",
    company: "ZBA Latam",
    role: "Bróker / intermediario",
    commodity: "Gold",
    reference: "AU-DORE-202607-CKG",
    accessUrl: "https://geocapitals.com/ficha/gcops_demo",
  },
} satisfies TemplateEntry;
