/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors, badge } from "./_shared";

// Ficha oficial de la operación Antimonio (Sb) — formato PURCHASE TERMS
// alineado a la mesa internacional (Buyer FL, 1.500 MT/mes × 12 meses,
// pago SWIFT MT103, referencia LMU/Fastmarkets). Reemplaza el envío anterior
// con SBLC MT760, que no aplica a operaciones por transferencia bancaria.

interface Assay {
  element: string;
  unit: string;
  batchA?: string;
  batchB?: string;
}

const ASSAYS: Assay[] = [
  { element: "Sb (Antimonio)", unit: "%", batchA: "99.85 / 99.90", batchB: "99.75" },
  { element: "As (Arsénico)", unit: "%", batchA: "0.015 – 0.036", batchB: "0.032" },
  { element: "Pb (Plomo)", unit: "%", batchA: "0.012 – 0.041", batchB: "0.20" },
  { element: "Fe (Hierro)", unit: "%", batchA: "0.0028 – 0.0030", batchB: "0.0023" },
  { element: "S (Azufre)", unit: "%", batchA: "0.0042 – 0.0047", batchB: "0.0026" },
  { element: "Cu (Cobre)", unit: "%", batchA: "0.026 – 0.029", batchB: "0.0053" },
  { element: "Se (Selenio)", unit: "%", batchA: "0.0010 – 0.0058", batchB: "<0.0010" },
  { element: "Bi (Bismuto)", unit: "%", batchA: "0.0016", batchB: "0.0007" },
  { element: "Cd (Cadmio)", unit: "%", batchA: "0.0004", batchB: "—" },
  { element: "Ag (Plata)", unit: "%", batchA: "0.0003 – 0.014", batchB: "—" },
  { element: "Sn (Estaño)", unit: "%", batchA: "0.0008", batchB: "—" },
];

interface Props {
  recipientName?: string;
  recipientCompany?: string;
  tradeReference?: string;
  senderCompany?: string;
  operationUrl?: string;
  sheetPdfUrl?: string;
  trackingPixelUrl?: string;
}

const thStyle = {
  fontSize: 12,
  fontWeight: 700,
  textAlign: "left" as const,
  padding: "8px 10px",
  background: "#0F2A6B",
  color: "#FFFFFF",
  borderBottom: `1px solid ${colors.border}`,
};

const tdStyle = {
  fontSize: 12,
  padding: "7px 10px",
  borderBottom: `1px solid ${colors.border}`,
  color: colors.text,
  fontFamily: "'IBM Plex Mono', monospace",
} as const;

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
    preview={`PURCHASE TERMS · Antimony Ingots (Sb) — 1,500 MT/mo × 12 mo · CIF Florida · ${tradeReference ?? ""}`}
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>Purchase Terms · Antimony Ingots (Sb)</Heading>
    <Text style={styles.p}>
      {recipientName ? `${recipientName}` : "Estimados"}
      {recipientCompany ? ` — ${recipientCompany}` : ""}: a continuación las condiciones formales de
      compra de <b>Antimony Ingots Sb ≥ 99.65%</b> para el comprador en <b>Florida, USA</b>. Este
      documento reemplaza cualquier borrador anterior que mencionara SBLC/DLC: la operación se
      liquidará por <b>transferencia bancaria internacional SWIFT MT103</b>. Toda la trazabilidad,
      documentos y firmas se llevan en la War Room privada.
    </Text>

    <KeyValueBlock
      rows={[
        ["Operación", tradeReference],
        ["Producto", "Antimony Ingots (Sb) — Refined Antimony Metal"],
        ["Pureza", "Mín. 99.65% Sb (superior por mutuo acuerdo)"],
        ["Estándar", "International Commercial Grade · Standard Ingots"],
        ["Volumen mensual", "1,500 MT / mes"],
        ["Duración", "Mínimo 12 meses, renovable por mutuo acuerdo"],
        ["Incoterm", "CIF — Buyer's Designated Port, Florida, USA"],
        ["Puerto de carga", "Seller's Option"],
        ["Primer embarque", "15–30 días bancarios post-SPA firmado"],
        ["Pago", "SWIFT MT103 · Wire Transfer contra Commercial Invoice y documentos completos"],
        [
          "Referencia de precio",
          "Índice internacional aplicable (LMU/LME reference o índice acordado, ej. Fastmarkets); fórmula final se fija en el SPA",
        ],
        ["Inspección", "SGS / CCIC / Alex Stewart o equivalente internacional"],
        ["Comisiones", "Definidas en SPA + NCNDA/IMFPA — ver sección Commissions"],
        ["Intermediario", senderCompany ?? "Geocapitals"],
      ]}
    />

    <SectionH>Commodity</SectionH>
    <Text style={styles.p}>
      Refined Antimony Metal Ingots · Marca de producción JH2601 / KRN (referencia) · Pallets de
      madera · Origen a opción del Seller · Presentación: pallets 300–320 / 26–50, stock verificable
      en bodega. Estándar de análisis GB/T 1599-2014. Trial Shipment opcional por mutuo acuerdo.
    </Text>

    <SectionH>
      Composición química — Certificados independientes {badge("success", "Sb ≥ 99.75%")}
    </SectionH>
    <Text style={styles.muted}>
      Columna A: CoA interno del productor (JH2601 · Pallets 26–50 y 301–320). Columna B: SGS
      Reporte 2025-2002470-001 · muestra 14 g, muestreo 22-Aug-2025.
    </Text>

    <Section style={{ margin: "10px 0 4px" }}>
      <table
        cellPadding={0}
        cellSpacing={0}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Elemento</th>
            <th style={{ ...thStyle, width: 60 }}>Unidad</th>
            <th style={thStyle}>CoA productor</th>
            <th style={thStyle}>SGS</th>
          </tr>
        </thead>
        <tbody>
          {ASSAYS.map((a, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#f7f6f4" : "#ffffff" }}>
              <td style={{ ...tdStyle, fontFamily: "Inter, Arial, sans-serif", fontWeight: 600 }}>
                {a.element}
              </td>
              <td style={tdStyle}>{a.unit}</td>
              <td style={tdStyle}>{a.batchA ?? "—"}</td>
              <td style={tdStyle}>{a.batchB ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>

    <SectionH>Delivery Terms</SectionH>
    <Text style={styles.p}>
      <b>Incoterm:</b> CIF Buyer's Designated Port, Florida, USA · <b>Loading Port:</b> Seller's
      Option · <b>Destination:</b> Puerto designado por el Buyer en Florida, EE.UU. ·{" "}
      <b>Schedule:</b> primer embarque dentro de 15–30 días bancarios tras la firma del SPA;
      embarques mensuales sucesivos por 12 meses.
    </Text>

    <SectionH>Price</SectionH>
    <Text style={styles.p}>
      El precio se referenciará al índice internacional aplicable para antimonio refinado. Dado que
      no existe un contrato LME estándar para antimonio, se acordará expresamente en el SPA
      definitivo la fuente de precio (LMU/LME reference o índice publicado ampliamente aceptado, ej.
      Fastmarkets), la ventana de fijación, descuentos, premios y comisiones.
    </Text>

    <SectionH>Payment Terms · SWIFT MT103</SectionH>
    <Text style={styles.p}>
      Pago por transferencia bancaria internacional (SWIFT MT103) contra Commercial Invoice del
      Seller y set completo de documentos de embarque. Fondos remitidos a la cuenta bancaria
      designada por el Seller. Cargos bancarios fuera del país del Seller por cuenta del Buyer.
      Milestones alternativos podrán definirse en el SPA por mutuo acuerdo.
    </Text>

    <SectionH>Proof of Product (POP)</SectionH>
    <Text style={styles.p}>
      Commercial Invoice · Packing List · Certificate of Origin · SGS Quality Certificate (o
      equivalente) · Product Specification Sheet · Warehouse Receipt / Availability Certificate
      (cuando aplique) · Export Authorization · Product Photographs · Draft Bill of Lading.
    </Text>

    <SectionH>Shipping Documents</SectionH>
    <Text style={styles.p}>
      Commercial Invoice · Packing List · Full Set Clean On Board Bills of Lading · Certificate of
      Origin · SGS Inspection Certificate · Weight Certificate · Quality Certificate · Insurance
      Certificate (CIF) · Export Customs Documentation · Container Loading Photographs.
    </Text>

    <SectionH>Inspection</SectionH>
    <Text style={styles.p}>
      Inspección de calidad y cantidad por SGS, CCIC, Alex Stewart International u otra firma
      internacionalmente reconocida y mutuamente aceptada. El Buyer podrá efectuar inspección de
      destino por su cuenta.
    </Text>

    <SectionH>Transaction Procedure</SectionH>
    <Text style={styles.p}>
      1. Buyer emite ICPO/LOI + Company Profile · 2. Seller emite FCO + CIS · 3. Buyer firma y
      devuelve FCO · 4. Seller emite Draft SPA · 5. Buyer firma y devuelve · 6. Seller contrafirma ·
      7. Commercial Invoice · 8. Confirmación de PO y cronograma · 9. Preparación de carga · 10.
      Inspección SGS/CCIC · 11. Embarque según cronograma · 12. Set completo de documentos · 13.
      <b> Pago SWIFT MT103</b> según SPA · 14. Arribo a Florida · 15. Inspección de destino (si
      aplica).
    </Text>

    <SectionH>Commissions</SectionH>
    <Text style={styles.p}>
      Cualquier comisión, fee de intermediación o compensación de facilitador será acordada por
      separado por las partes e incorporada expresamente al SPA definitivo y al Fee Protection
      Agreement (NCNDA/IMFPA), cuando corresponda.
    </Text>

    <SectionH>Buyer</SectionH>
    <Text style={styles.p}>
      Ubicación: Florida, Estados Unidos · Cantidad requerida: 1,500 MT/mes · Contrato mínimo: 12
      meses · Extensiones por acuerdo escrito mutuo.
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
          Copia oficial (PDF) — Purchase Terms + Ficha técnica
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
          <b>Aceptación y trazabilidad.</b> Para aceptar formalmente estos términos, subir fotos del
          material, cargar CoA/SGS y firmar los documentos, use su War Room privada:
          <br />
          <a href={operationUrl} style={{ color: colors.primary, fontWeight: 600 }}>
            {operationUrl}
          </a>
        </Text>
      </>
    ) : null}

    <Text style={styles.muted}>
      Cualquier consulta técnica o comercial: info@geocapitals.com · WhatsApp +56 9 6218 4071. Este
      envío está cubierto por el NCNDA suscrito entre las partes.
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
      SPA definitivo firmado por ambas partes.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Purchase Terms Antimony (Sb) — 1,500 MT/mo × 12 mo · CIF Florida${
      d.tradeReference ? ` — ${String(d.tradeReference)}` : ""
    }`,
  displayName: "Antimonio · Purchase Terms + Ficha técnica",
  previewData: {
    recipientName: "Vincent Carpio",
    recipientCompany: "Carpio & Kaddu Group",
    tradeReference: "SB-ANTIMONIO-202607-4434",
    senderCompany: "Geocapitals",
    operationUrl: "https://geocapitals.com/operacion/demo",
  },
} satisfies TemplateEntry;
