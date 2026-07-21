/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors } from "./_shared";

// Despacho automatizado bajo NCNDA de una ficha de proveedor a un comprador
// seleccionado desde el Dashboard. Reutiliza el modelo estándar de emails de
// Geocapitals (EmailLayout / KeyValueBlock).

interface Props {
  recipientName?: string;
  recipientCompany?: string;
  senderCompany?: string;
  requestReference?: string;
  commodity?: string;
  form?: string;
  quantityT?: string | number;
  incoterm?: string;
  destination?: string;
  supplierName?: string;
  supplierCompany?: string;
  supplierCountry?: string;
  offerPrice?: string;
  offerValidUntil?: string;
  sheetUrl?: string;
  ncndaRef?: string;
  note?: string;
  trackingPixelUrl?: string;
}

const Email = ({
  recipientName,
  recipientCompany,
  senderCompany,
  requestReference,
  commodity,
  form,
  quantityT,
  incoterm,
  destination,
  supplierName,
  supplierCompany,
  supplierCountry,
  offerPrice,
  offerValidUntil,
  sheetUrl,
  ncndaRef,
  note,
  trackingPixelUrl,
}: Props) => (
  <EmailLayout
    preview={`Ficha de proveedor bajo NCNDA · ${commodity ?? "commodity"}${
      requestReference ? ` · ${requestReference}` : ""
    }`}
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>
      Ficha de proveedor bajo NCNDA · {commodity ?? "Commodity"}
    </Heading>
    <Text style={styles.p}>
      {recipientName ? `${recipientName}` : "Estimado(a)"}
      {recipientCompany ? ` — ${recipientCompany}` : ""}: {senderCompany ?? "Geocapitals"} le
      comparte la ficha del proveedor preseleccionado para el requerimiento{" "}
      <b>{requestReference ?? "en curso"}</b>. Este envío se realiza bajo el{" "}
      <b>NCNDA vigente</b> entre las Partes: la información es confidencial y su uso queda
      limitado a la evaluación de la operación.
    </Text>

    <KeyValueBlock
      rows={[
        ["Requerimiento", requestReference],
        ["Commodity", commodity],
        ["Forma", form],
        ["Cantidad", quantityT ? `${quantityT} t` : undefined],
        ["Incoterm", incoterm],
        ["Destino", destination],
        ["Proveedor", supplierName],
        ["Empresa proveedor", supplierCompany],
        ["Procedencia", supplierCountry],
        ["Precio ofertado", offerPrice],
        ["Oferta válida hasta", offerValidUntil],
        ["NCNDA de referencia", ncndaRef],
      ]}
    />

    {note ? (
      <Text style={{ ...styles.p, fontStyle: "italic", color: colors.muted }}>{note}</Text>
    ) : null}

    {sheetUrl ? (
      <Section
        style={{
          margin: "18px 0 8px",
          padding: "14px 16px",
          background: "#F1F4FF",
          borderLeft: `3px solid ${colors.primary}`,
        }}
      >
        <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 4 }}>
          Abrir ficha completa
        </Text>
        <Text style={styles.muted}>
          Documento electrónico con QR de verificación · optimizado para escritorio y móvil.
        </Text>
        <a
          href={sheetUrl}
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "10px 18px",
            background: colors.primary,
            color: "#FFFFFF",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Ver ficha del proveedor
        </a>
        <Text style={{ ...styles.muted, marginTop: 8, wordBreak: "break-all" }}>{sheetUrl}</Text>
      </Section>
    ) : null}

    <Hr style={styles.hr} />
    <Text style={styles.muted}>
      Consultas comerciales: info@geocapitals.com · WhatsApp +56 9 6218 4071. Este envío está
      cubierto por el NCNDA suscrito entre las Partes. Prohibida su reproducción o divulgación
      a terceros sin autorización escrita.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Ficha de proveedor bajo NCNDA${
      d.commodity ? ` — ${String(d.commodity)}` : ""
    }${d.requestReference ? ` · ${String(d.requestReference)}` : ""}`,
  displayName: "Sourcing · Ficha de proveedor (dispatch)",
  previewData: {
    recipientName: "Buyer",
    recipientCompany: "Sample Buyer LLC",
    senderCompany: "Geocapitals",
    requestReference: "RFQ-CATODOS-CU-202607",
    commodity: "Cátodos de cobre 99.99% Cu",
    form: "Cathode Plates",
    quantityT: 300,
    incoterm: "EXW",
    destination: "Global",
    supplierName: "Grupo Minero",
    supplierCompany: "Grupo Minero S.A. de C.V.",
    supplierCountry: "México",
    offerPrice: "US$ 9,350/t (LME −5%)",
    offerValidUntil: "2026-08-15",
    sheetUrl: "https://geocapitals.com/ficha-proveedor/demo-token",
    ncndaRef: "NCNDA-202607-0001",
  },
} satisfies TemplateEntry;
