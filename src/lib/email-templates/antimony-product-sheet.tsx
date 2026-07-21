/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors, badge } from "./_shared";

// Ficha técnica del antimonio (Sb Grade 2#) que Geocapitals envía a los
// compradores (Carpio & Kaddu Group) para que evalúen la calidad del lote
// antes del envío del SCO/LOI. Los valores provienen de los CoA del proveedor
// (Aupal Propiedades) — 2 batches independientes (JH2601 y SGS 2025-2002470).

interface Assay {
  element: string;
  unit: string;
  batchA?: string; // JH2601 (CoA interno)
  batchB?: string; // SGS 2025-2002470
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

const Email = ({
  recipientName,
  recipientCompany,
  tradeReference,
  senderCompany,
  operationUrl,
}: Props) => (
  <EmailLayout
    preview={`Ficha técnica · Antimonio Sb Grade 2# — CoA + SGS · ${tradeReference ?? ""}`}
  >
    <Heading style={styles.h1}>Ficha técnica · Antimonio (Sb) Grade 2#</Heading>
    <Text style={styles.p}>
      {recipientName ? `${recipientName}` : "Estimados"}
      {recipientCompany ? ` — ${recipientCompany}` : ""}: adjunto la ficha resumen y ficha técnica
      del lote de antimonio ofrecido por nuestro proveedor certificado. Toda la trazabilidad,
      documentos originales y firmas quedan disponibles en la War Room de la operación.
    </Text>

    <KeyValueBlock
      rows={[
        ["Operación", tradeReference],
        ["Producto", "Antimony Ingot — Grade 2#"],
        ["Marca de producción", "JH2601 / KRN (referencia)"],
        ["Forma", "Lingote (ingot), pallets de madera"],
        ["Origen", "Proveedor certificado — CoA + SGS disponibles"],
        ["Presentación", "Pallets 300–320 / 26–50 · stock en bodega"],
        ["Estándar de análisis", "GB/T 1599-2014 (SGS)"],
        ["Intermediario", senderCompany ?? "Geocapitals"],
      ]}
    />

    <Text style={{ ...styles.p, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>
      Composición química — Certificados independientes {badge("success", "Sb ≥ 99.75%")}
    </Text>
    <Text style={styles.muted}>
      Columna A: CoA interno del productor (JH2601 · Pallets 26–50 y 301–320). Columna B: SGS
      Reporte 2025-2002470-001 · muestra en polvo 14 g, muestreo 22-Aug-2025.
    </Text>

    <Section style={{ margin: "12px 0 4px" }}>
      <table
        cellPadding={0}
        cellSpacing={0}
        style={{ width: "100%", borderCollapse: "collapse", borderTop: `1px solid ${colors.border}` }}
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

    <Hr style={styles.hr} />

    <Text style={{ ...styles.p, fontWeight: 700, marginBottom: 6 }}>
      Próximos pasos — desde Geocapitals
    </Text>
    <Text style={styles.p}>
      1 · Confirmen destino final (puerto y país) y volumen objetivo del primer embarque para
      responder con SCO (Soft Corporate Offer) y draft de contrato bajo el NCNDA ya firmado.
      <br />2 · Podemos coordinar inspección independiente (SGS / Bureau Veritas) previa al
      embarque y validación de origen legal del material.
      <br />3 · Instrumento de pago sugerido: <b>SBLC MT760</b> irrevocable, confirmado por banco
      de primer nivel, contra documentos de embarque.
    </Text>

    {operationUrl ? (
      <Text style={styles.p}>
        War Room de la operación:{" "}
        <a href={operationUrl} style={{ color: colors.primary, fontWeight: 600 }}>
          {operationUrl}
        </a>
      </Text>
    ) : null}

    <Text style={styles.muted}>
      Cualquier consulta técnica o comercial: info@geocapitals.com · WhatsApp +56 9 6218 4071.
      Este envío está cubierto por el NCNDA suscrito entre las partes.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Geocapitals · Ficha técnica Antimonio Sb Grade 2#${
      d.tradeReference ? ` — ${String(d.tradeReference)}` : ""
    }`,
  displayName: "Antimonio · Ficha técnica (CoA + SGS)",
  previewData: {
    recipientName: "Vincent Carpio",
    recipientCompany: "Carpio & Kaddu Group",
    tradeReference: "SB-ANTIMONIO-202607-4434",
    senderCompany: "Geocapitals",
    operationUrl: "https://geocapitals.com/operacion/demo",
  },
} satisfies TemplateEntry;
