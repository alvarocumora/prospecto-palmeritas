/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors, badge } from "./_shared";

// Purchase Terms · Electrolytic Copper Cathode Grade A
// ASTM B115 / B49 · 2,000 MT/mes × 12 meses · CIF · DLC MT700 o SBLC MT760.

interface Props {
  recipientName?: string;
  recipientCompany?: string;
  tradeReference?: string;
  senderCompany?: string;
  operationUrl?: string;
  sheetPdfUrl?: string;
  trackingPixelUrl?: string;
}

const SectionH = ({ children }: { children: React.ReactNode }) => (
  <Text
    style={{
      ...styles.p,
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: colors.primary,
      margin: "22px 0 6px",
    }}
  >
    {children}
  </Text>
);

const Email = ({
  recipientName,
  recipientCompany,
  tradeReference,
  senderCompany,
  operationUrl,
  sheetPdfUrl,
  trackingPixelUrl,
}: Props) => (
  <EmailLayout
    preview={`PURCHASE TERMS · Copper Cathode Grade A — 2,000 MT/mo × 12 mo · CIF · DLC MT700${
      tradeReference ? ` · ${tradeReference}` : ""
    }`}
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>Purchase Terms · Electrolytic Copper Cathode Grade A</Heading>
    <Text style={styles.p}>
      {recipientName ? `${recipientName}` : "Estimados"}
      {recipientCompany ? ` — ${recipientCompany}` : ""}: a continuación las condiciones formales de
      compra de <b>Electrolytic Copper Cathode Grade A</b> (ASTM B115 / B49, pureza 99.97% – 99.99%
      Cu). Trial 500 MT, contrato de <b>2,000 MT/mes por 12 meses</b>, entrega CIF puerto designado
      por el Buyer, pago mediante <b>DLC MT700</b> o <b>SBLC MT760</b> por Top 50 International
      Bank. Toda la trazabilidad, documentos y firmas se llevan en la War Room privada.
    </Text>

    <KeyValueBlock
      rows={[
        ["Operación", tradeReference],
        ["Producto", "Electrolytic Copper Cathode Grade A"],
        ["Estándar", "ASTM B115 / ASTM B49"],
        ["Pureza", "99.97% – 99.99% Cu · Grado A"],
        ["Forma", "Cathode Plates"],
        ["Trial Quantity", "500 MT"],
        ["Contract Quantity", "2,000 MT / mes"],
        ["Duración", "12 meses + extensiones por mutuo acuerdo"],
        ["Incoterm", "CIF — Buyer's Designated Port"],
        ["Puerto de carga", "Seller's Option"],
        ["Shipment Schedule", "15–20 días bancarios tras verificación del instrumento financiero"],
        ["Pago (Opción A)", "DLC MT700 irrevocable, transferible, confirmada, at sight · UCP 600"],
        ["Pago (Opción B)", "SBLC MT760 irrevocable y transferible · Top 50 International Bank"],
        ["Performance Bond", "2% emitido por Seller (10 días bancarios post-verificación)"],
        ["Origen", "Seller's Option"],
        ["Inspección", "SGS / CCIC / Alex Stewart o equivalente internacional"],
        ["Intermediario", senderCompany ?? "Geocapitals"],
      ]}
    />

    <SectionH>Commodity</SectionH>
    <Text style={styles.p}>
      Electrolytic Copper Cathode Grade A · Estándar <b>ASTM B115 / ASTM B49</b> · Pureza{" "}
      <b>99.97% – 99.99% Cu</b> · Forma: <b>Cathode Plates</b> · Origen: Seller's Option ·
      Inspección independiente por SGS / CCIC / Alex Stewart o equivalente internacionalmente
      aceptada. {badge("success", "Cu ≥ 99.97%")}
    </Text>

    <SectionH>Delivery Terms</SectionH>
    <Text style={styles.p}>
      <b>Incoterm:</b> CIF Buyer's Designated Port · <b>Loading Port:</b> Seller's Option ·{" "}
      <b>Destination:</b> puerto designado por el Buyer · <b>Shipment Schedule:</b> 15–20 días
      bancarios tras recepción y verificación del instrumento financiero operativo.
    </Text>

    <SectionH>Payment · Opción A · DLC MT700</SectionH>
    <Text style={styles.p}>
      Buyer emitirá una{" "}
      <b>Carta de Crédito Documentaria Irrevocable, Transferible y Confirmada (SWIFT MT700)</b>{" "}
      emitida por un <b>Top 50 International Bank</b> aceptable al Seller. La DLC será: pagadera{" "}
      <b>a la vista (at sight)</b>, transferible, confirmada, sujeta a <b>UCP 600</b>, y con validez
      para el periodo de embarque y pago.
    </Text>

    <SectionH>Payment · Opción B · SBLC MT760</SectionH>
    <Text style={styles.p}>
      Buyer podrá emitir una{" "}
      <b>Standby Letter of Credit Irrevocable y Transferible (SWIFT MT760)</b> emitida por un Top 50
      International Bank aceptable al Seller. Tras autenticación y aceptación de la SBLC, el Seller
      iniciará el performance contractual.
    </Text>

    <SectionH>Performance Bond (PB)</SectionH>
    <Text style={styles.p}>
      El Seller emitirá un <b>Performance Bond de 2%</b> dentro de <b>diez (10) días bancarios</b>{" "}
      tras recepción y verificación del instrumento operativo (DLC MT700 o SBLC MT760).
    </Text>

    <SectionH>Proof of Product (POP)</SectionH>
    <Text style={styles.p}>
      Dentro de cinco (5) días bancarios tras confirmación del instrumento financiero: Commercial
      Invoice · Packing List · Certificate of Origin · SGS Quality Certificate · Warehouse Receipt /
      Availability Certificate · Export Authorization (cuando aplique) · Product Photographs · Draft
      Bill of Lading.
    </Text>

    <SectionH>Shipping Documents</SectionH>
    <Text style={styles.p}>
      Commercial Invoice · Packing List · Full Set Clean On Board Bills of Lading · Certificate of
      Origin · SGS Inspection Certificate · Weight Certificate · Quality Certificate ·{" "}
      <b>Insurance Certificate (110% CIF Value)</b> · Container Loading Photographs · Export Customs
      Documentation.
    </Text>

    <SectionH>Inspection</SectionH>
    <Text style={styles.p}>
      Inspección de calidad y cantidad por SGS · CCIC · Alex Stewart o firma internacional
      equivalente. Inspección de destino podrá realizarla el Buyer por su propia cuenta.
    </Text>

    <SectionH>Transaction Procedure</SectionH>
    <Text style={styles.p}>
      1. Buyer emite ICPO/LOI + CIS · 2. Seller emite FCO + CIS · 3. Buyer firma y devuelve FCO · 4.
      Seller emite Draft SPA · 5. Buyer firma y devuelve · 6. Seller contrafirma · 7. Seller emite
      Proforma Invoice · 8. Buyer emite <b>DLC MT700 o SBLC MT760</b> · 9. Seller verifica
      instrumento vía canales bancarios · 10. Seller emite <b>PB 2%</b> y POP · 11. Embarque en
      15–20 días bancarios · 12. Set completo de documentos · 13. Arribo a destino · 14. Inspección
      de destino · 15. Pago según DLC o vía MT103 contra documentos.
    </Text>

    {sheetPdfUrl ? (
      <Section
        style={{
          margin: "18px 0 8px",
          padding: "12px 14px",
          background: "#F1F4FF",
          borderLeft: `3px solid ${colors.primary}`,
        }}
      >
        <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 4 }}>
          Copia oficial (PDF) — Purchase Terms Copper Cathode Grade A
        </Text>
        <Text style={styles.muted}>
          Documento firmado por Geocapitals con sello de confidencialidad y QR de validación.
        </Text>
        <a
          href={sheetPdfUrl}
          style={{
            display: "inline-block",
            marginTop: 6,
            padding: "9px 16px",
            background: colors.primary,
            color: "#FFFFFF",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Descargar Purchase Terms (PDF)
        </a>
      </Section>
    ) : null}

    {operationUrl ? (
      <>
        <Hr style={styles.hr} />
        <Text style={styles.p}>
          <b>Aceptación y trazabilidad.</b> Para aceptar formalmente estos términos, cargar
          documentación (CoA/SGS/warehouse) y firmar el SPA, use su War Room privada:
          <br />
          <a href={operationUrl} style={{ color: colors.primary, fontWeight: 600 }}>
            {operationUrl}
          </a>
        </Text>
      </>
    ) : null}

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
      CONFIDENCIAL — Este mensaje y el PDF adjunto son propiedad de Geocapitals y de las Partes
      identificadas. Contienen información sensible cubierta por acuerdo de confidencialidad
      (NCNDA). Prohibida su reproducción, distribución o divulgación a terceros sin autorización
      escrita. Este documento no constituye oferta vinculante; la obligación de compra nace con el
      SPA definitivo firmado por ambas Partes.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Purchase Terms Copper Cathode Grade A — 2,000 MT/mo × 12 mo · CIF · DLC MT700${
      d.tradeReference ? ` — ${String(d.tradeReference)}` : ""
    }`,
  displayName: "Cobre · Purchase Terms (Cathode Grade A)",
  previewData: {
    recipientName: "Buyer",
    recipientCompany: "Sample Buyer LLC",
    tradeReference: "CU-CATHODE-202607-1234",
    senderCompany: "Geocapitals",
    operationUrl: "https://geocapitals.com/operacion/demo",
  },
} satisfies TemplateEntry;
