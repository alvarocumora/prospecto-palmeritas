/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Section, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors, appUrl } from "./_shared";

interface Project {
  name: string;
}

interface Props {
  recipientEmail?: string;
  fullName?: string;
  onboardingUrl?: string;
  ncndaUrl?: string;
  projects?: Project[];
  trades?: { reference: string; commodity: string }[];
  invitedByName?: string;
  personalMessage?: string;
  trackingPixelUrl?: string;
}

const Email = ({
  fullName,
  onboardingUrl,
  ncndaUrl,
  projects = [],
  trades = [],
  invitedByName,
  personalMessage,
  trackingPixelUrl,
}: Props) => (
  <EmailLayout
    preview="Acceso preparado a Geocapitals: NCNDA + Data Rooms + Trade en curso"
    ctaHref={onboardingUrl ?? appUrl("/")}
    ctaLabel="Activar mi acceso"
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>
      {fullName ? `Hola ${fullName},` : "Hola,"} tienes acceso preparado a Geocapitals
    </Heading>

    <Text style={styles.p}>
      {invitedByName ? `${invitedByName} de ` : ""}
      Geocapitals te habilitó acceso institucional a nuestra plataforma de operaciones mineras y
      trading de commodities. Puedes registrarte como <b>broker</b> o como{" "}
      <b>cliente / inversionista</b>: al firmar el NCNDA se activan de inmediato los data rooms y
      la operación en curso listados abajo.
    </Text>

    {personalMessage ? (
      <Section
        style={{
          margin: "8px 0 16px",
          padding: "12px 14px",
          background: "#F7F4EC",
          borderLeft: `3px solid ${colors.primary}`,
        }}
      >
        <Text style={{ ...styles.p, whiteSpace: "pre-wrap", margin: 0 }}>{personalMessage}</Text>
      </Section>
    ) : null}

    <KeyValueBlock
      rows={[
        ["Documento adjunto", "NCNDA firmado por Geocapitals (falta tu firma)"],
        ["Rol sugerido", "Broker o Cliente/Inversionista (eliges al activar)"],
        ["Proyectos con data room", projects.map((p) => p.name).join(" · ") || "—"],
        [
          "Trade activo",
          trades.map((t) => `${t.commodity} · ${t.reference}`).join(" · ") || "—",
        ],
      ]}
    />

    {ncndaUrl ? (
      <Text style={{ ...styles.p, marginTop: 14 }}>
        <b>NCNDA (Non-Circumvention / NDA):</b>{" "}
        <a href={ncndaUrl} style={{ color: colors.primary, fontWeight: 600 }}>
          Descargar PDF firmado por Geocapitals
        </a>
        . Se validará con el QR estampado al reverso del documento.
      </Text>
    ) : null}

    <Hr style={styles.hr} />

    <Text style={{ ...styles.p, fontWeight: 600 }}>Qué ocurre al hacer clic en el botón:</Text>
    <Text style={styles.p}>
      1. Eliges tu rol (broker / cliente / ambos).
      <br />
      2. Firmas electrónicamente el NCNDA (nombre + IP + fecha).
      <br />
      3. Se activan los data rooms de los proyectos listados y el acceso al trade en curso.
      <br />
      4. Aterrizas en tu dashboard personalizado.
    </Text>

    <Text style={styles.muted}>
      Dudas comerciales o técnicas: info@geocapitals.com · WhatsApp{" "}
      <a href="https://wa.me/56962184071" style={{ color: colors.primary }}>
        +56 9 6218 4071
      </a>
      . Este envío está cubierto por el NCNDA que firmarás al activar el acceso.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const name = d.fullName ? ` ${String(d.fullName).split(" ")[0]}` : "";
    return `Geocapitals · Acceso preparado${name} — NCNDA + Data Rooms`;
  },
  displayName: "Partner · Invitación broker/cliente (NCNDA + Data Rooms)",
  previewData: {
    fullName: "Joaquín Belmar",
    invitedByName: "Álvaro Oliva",
    onboardingUrl: "https://geocapitals.com/onboarding/DEMO",
    ncndaUrl: "https://geocapitals.com/verificar/NCNDA-DEMO",
    projects: [
      { name: "Distrito Cuprífero Los Verdes – Tilama" },
      { name: "Prospecto Las Palmeras" },
      { name: "Prospecto Gianfranco" },
      { name: "La Cornellana" },
    ],
    trades: [{ commodity: "Copper (Cu)", reference: "CU-CONC-202607-CKG" }],
    personalMessage:
      "Adjunto NCNDA firmado por Geocapitals y el link para activar tu acceso al data room de los 4 proyectos y a la operación de cobre 2.000 MT/mes.",
  },
} satisfies TemplateEntry;
