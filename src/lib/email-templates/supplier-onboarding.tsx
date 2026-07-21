/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Button } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles } from "./_shared";

interface Props {
  supplierName?: string;
  supplierCompany?: string;
  tradeReference?: string;
  commodity?: string;
  senderCompany?: string;
  ndaUrl?: string;
  loiUrl?: string;
  portalUrl?: string;
  expiresAt?: string;
  ndaPdfUrl?: string;
  loiPdfUrl?: string;
}

const btn = {
  ...styles.p,
  display: "inline-block" as const,
  background: "#0F2A6B",
  color: "#FFFFFF",
  padding: "10px 18px",
  borderRadius: 6,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
  margin: "6px 8px 6px 0",
};

const btnAlt = { ...btn, background: "#111111" };
const btnGhost = { ...btn, background: "#FFFFFF", color: "#0F2A6B", border: "1px solid #0F2A6B" };

const Email = ({
  supplierName,
  supplierCompany,
  tradeReference,
  commodity,
  senderCompany,
  ndaUrl,
  loiUrl,
  portalUrl,
  expiresAt,
  ndaPdfUrl,
  loiPdfUrl,
}: Props) => (
  <EmailLayout
    preview={`Onboarding proveedor · ${commodity ?? "operación"} — NDA + LOI + carga de documentos`}
  >
    <Heading style={styles.h1}>Onboarding de proveedor · Geocapitals</Heading>
    <Text style={styles.p}>
      {supplierName ? `${supplierName}` : "Estimado proveedor"}
      {supplierCompany ? ` — ${supplierCompany}` : ""}: {senderCompany ?? "Geocapitals"} actúa como
      intermediario y gestor operacional de la operación indicada. Para avanzar a due diligence y
      documentación de embarque, por favor complete los tres pasos siguientes.
    </Text>

    <KeyValueBlock
      rows={[
        ["Operación", tradeReference],
        ["Producto", commodity],
        ["Gestor", senderCompany],
        ["Validez de los enlaces", expiresAt],
      ]}
    />

    <Section style={{ margin: "16px 0" }}>
      <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 4 }}>
        1 · Firmar Acuerdo de Confidencialidad (NDA)
      </Text>
      <Button href={ndaUrl} style={btn}>
        Revisar y firmar NDA
      </Button>
    </Section>

    <Section style={{ margin: "16px 0" }}>
      <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 4 }}>
        2 · Firmar Carta de Intención (LOI)
      </Text>
      <Button href={loiUrl} style={btnAlt}>
        Revisar y firmar LOI
      </Button>
    </Section>

    <Section style={{ margin: "16px 0" }}>
      <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 4 }}>
        3 · Subir documentación en el Portal Proveedor
      </Text>
      <Text style={styles.muted}>
        CoA, SGS, certificado de origen, factura pro-forma, KYC de la empresa y fotos de stock.
      </Text>
      <Button href={portalUrl} style={btnGhost}>
        Abrir Portal Proveedor
      </Button>
    </Section>

    <Text style={styles.muted}>
      Todos los enlaces son personales e intransferibles. Cualquier consulta: info@geocapitals.com ·
      WhatsApp +56 9 6218 4071.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Onboarding proveedor${
      d.commodity ? ` — ${String(d.commodity)}` : ""
    } (NDA + LOI + Portal)`,
  displayName: "Proveedor · Onboarding (NDA + LOI + Portal)",
  previewData: {
    supplierName: "Ana Rojo",
    supplierCompany: "Aupal Propiedades",
    tradeReference: "SB-ANTIMONIO-202607-4434",
    commodity: "Antimonio — lingote 99.85% Sb",
    senderCompany: "Geocapitals",
    ndaUrl: "https://geocapitals.com/firmar/gcsign_nda_demo",
    loiUrl: "https://geocapitals.com/firmar/gcsign_loi_demo",
    portalUrl: "https://geocapitals.com/portal-proveedor?trade=SB-ANTIMONIO-202607-4434",
    expiresAt: "15 días",
  },
} satisfies TemplateEntry;
