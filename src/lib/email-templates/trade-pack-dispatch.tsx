/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors } from "./_shared";

interface PackDoc {
  label: string;
  url: string;
  filename: string;
}

interface Props {
  recipientEmail?: string;
  tradeReference?: string;
  commodity?: string;
  quantityMt?: number | null;
  incoterm?: string | null;
  paymentInstrument?: string | null;
  customSubject?: string | null;
  customMessage?: string | null;
  operationUrl?: string;
  docs?: PackDoc[];
  trackingPixelUrl?: string;
}

const Email = ({
  tradeReference,
  commodity,
  quantityMt,
  incoterm,
  paymentInstrument,
  customMessage,
  operationUrl,
  docs = [],
  trackingPixelUrl,
}: Props) => (
  <EmailLayout
    preview={`Document Pack · ${commodity ?? "Operación"}${tradeReference ? ` — ${tradeReference}` : ""}`}
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>Document Pack — {commodity ?? "Operación"}</Heading>
    <Text style={styles.p}>
      Le compartimos el <b>paquete oficial de documentos</b> para la operación indicada. Cada
      archivo está firmado por Geocapitals con sello de confidencialidad y QR de validación.
    </Text>

    {customMessage ? (
      <Text style={{ ...styles.p, whiteSpace: "pre-wrap" }}>{customMessage}</Text>
    ) : null}

    <KeyValueBlock
      rows={[
        ["Operación", tradeReference],
        ["Commodity", commodity],
        ["Cantidad", quantityMt ? `${Number(quantityMt).toLocaleString("en-US")} MT` : undefined],
        ["Incoterm", incoterm ?? undefined],
        ["Pago", paymentInstrument ?? undefined],
      ]}
    />

    {docs.length > 0 && (
      <Section
        style={{
          margin: "18px 0 8px",
          padding: "14px 16px",
          background: "#F1F4FF",
          borderLeft: `3px solid ${colors.primary}`,
        }}
      >
        <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 8 }}>
          Documentos oficiales (PDF)
        </Text>
        {docs.map((d) => (
          <Text key={d.filename} style={{ ...styles.p, margin: "4px 0" }}>
            ·{" "}
            <a
              href={d.url}
              style={{ color: colors.primary, fontWeight: 600, textDecoration: "underline" }}
            >
              {d.label}
            </a>{" "}
            <span style={{ color: "#6B7280", fontSize: 11 }}>({d.filename})</span>
          </Text>
        ))}
      </Section>
    )}

    {operationUrl && (
      <>
        <Hr style={styles.hr} />
        <Text style={styles.p}>
          <b>War Room privada de la operación:</b>
          <br />
          <a href={operationUrl} style={{ color: colors.primary, fontWeight: 600 }}>
            {operationUrl}
          </a>
        </Text>
      </>
    )}

    <Text style={styles.muted}>
      Consultas técnicas o comerciales: info@geocapitals.com · WhatsApp +56 9 6218 4071. Este envío
      está cubierto por el NCNDA suscrito entre las Partes.
    </Text>

    <Text
      style={{
        ...styles.muted,
        fontSize: 11,
        marginTop: 12,
        padding: "8px 10px",
        background: "#FFF7E6",
        borderLeft: "3px solid #E8C765",
      }}
    >
      CONFIDENCIAL — Los PDFs adjuntos son propiedad de Geocapitals y de las Partes identificadas.
      Prohibida su reproducción, distribución o divulgación a terceros sin autorización escrita.
      Estos documentos no constituyen oferta vinculante; la obligación de compra nace con el SPA
      definitivo firmado por ambas Partes.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    if (d.customSubject && typeof d.customSubject === "string") return d.customSubject;
    const ref = d.tradeReference ? ` — ${String(d.tradeReference)}` : "";
    const c = d.commodity ? ` · ${String(d.commodity)}` : "";
    return `Geocapitals · Document Pack${c}${ref}`;
  },
  displayName: "Trade · Document Pack (Ficha + LOI + NCNDA + ICPO + SPA)",
  previewData: {
    tradeReference: "SB-ANTIMONIO-202607-4434",
    commodity: "Antimony Ingots",
    quantityMt: 1500,
    incoterm: "CIF Florida",
    paymentInstrument: "SWIFT MT103",
    operationUrl: "https://geocapitals.com/operacion/demo",
    docs: [
      { label: "Ficha Técnica · Purchase Terms", url: "#", filename: "FICHA-DEMO.pdf" },
      { label: "LOI · Carta de Intención", url: "#", filename: "LOI-DEMO.pdf" },
    ],
  },
} satisfies TemplateEntry;
