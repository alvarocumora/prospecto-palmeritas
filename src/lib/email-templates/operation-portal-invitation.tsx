/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, styles, colors } from "./_shared";

interface Props {
  fullName?: string;
  role?: "buyer" | "seller";
  operationCode?: string;
  operationName?: string;
  commodity?: string;
  incoterm?: string;
  quantityLabel?: string;
  originCountry?: string;
  destinationCountry?: string;
  portalUrl?: string;
  expiresAt?: string;
  invitedByName?: string;
  trackingPixelUrl?: string;
}

const roleLabel = (r?: string) =>
  r === "buyer" ? "Comprador" : r === "seller" ? "Vendedor" : "Contraparte";

const Email = ({
  fullName,
  role,
  operationCode,
  operationName,
  commodity,
  incoterm,
  quantityLabel,
  originCountry,
  destinationCountry,
  portalUrl,
  expiresAt,
  invitedByName,
  trackingPixelUrl,
}: Props) => (
  <EmailLayout
    preview={`Portal privado ${roleLabel(role)} — Operación ${operationCode ?? ""}`}
    ctaHref={portalUrl ?? "https://geocapitals.com"}
    ctaLabel={`Abrir portal ${roleLabel(role)}`}
    trackingPixelUrl={trackingPixelUrl}
  >
    <Heading style={styles.h1}>
      {fullName ? `Hola ${fullName},` : "Hola,"} tu portal {roleLabel(role).toLowerCase()} está
      listo
    </Heading>

    <Text style={styles.p}>
      {invitedByName ? `${invitedByName} de ` : ""}Geocapitals ha creado un espacio privado y seguro
      para la operación <b>{operationCode}</b>
      {operationName ? ` — ${operationName}` : ""}. Desde tu portal puedes revisar el checklist,
      subir documentación (KYC / LOI / PoF / permisos / ensayes) y coordinar directamente con
      nuestro equipo. Solo tú y Geocapitals ven este canal — la contraparte tiene su propio portal
      separado.
    </Text>

    <KeyValueBlock
      rows={[
        ["Rol", roleLabel(role)],
        ["Operación", operationCode ?? "—"],
        ["Commodity", commodity ?? "—"],
        ["Volumen", quantityLabel ?? "—"],
        ["Incoterm", incoterm ?? "—"],
        [
          "Origen → Destino",
          [originCountry, destinationCountry].filter(Boolean).join(" → ") || "—",
        ],
        [
          "Vigencia del enlace",
          expiresAt ? new Date(expiresAt).toLocaleDateString("es-CL") : "30 días",
        ],
      ]}
    />

    <Hr style={styles.hr} />

    <Text style={{ ...styles.p, fontWeight: 600 }}>Cómo activar tu acceso:</Text>
    <Text style={styles.p}>
      1. Abre el portal desde el botón superior.
      <br />
      2. Inicia sesión o crea tu cuenta con este mismo correo.
      <br />
      3. Se vincula automáticamente a la operación y ves el checklist en vivo.
    </Text>

    <Text style={styles.muted}>
      Este enlace es personal, cifrado y trazable. No lo compartas: cada acceso queda auditado.
      Dudas: info@geocapitals.com ·{" "}
      <a href="https://wa.me/56962184071" style={{ color: colors.primary }}>
        WhatsApp +56 9 6218 4071
      </a>
      .
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const role = roleLabel(d.role as string);
    const code = d.operationCode ? ` ${d.operationCode}` : "";
    return `Geocapitals · Portal ${role} — Operación${code}`;
  },
  displayName: "Operaciones · Invitación portal buyer/seller",
  previewData: {
    fullName: "Ana Rojo",
    role: "buyer",
    operationCode: "GC-CU-202608-001",
    operationName: "Cobre Concentrado 2.000 MT/mes",
    commodity: "Copper concentrate",
    incoterm: "CIF",
    quantityLabel: "2.000 MT/mes",
    originCountry: "Chile",
    destinationCountry: "China",
    portalUrl: "https://geocapitals.com/portal/buyer/DEMO",
    invitedByName: "Álvaro Oliva",
  },
} satisfies TemplateEntry;
