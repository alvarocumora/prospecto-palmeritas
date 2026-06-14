/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, badge, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  projectCode?: string;
  concessionCode?: string;
  concessionName?: string;
  holder?: string;
  expiresAt?: string;
  daysRemaining?: number;
  region?: string;
  areaHa?: number;
  patentAmountClp?: number;
  concessionId?: string;
}

const Email = ({
  recipientName,
  projectName,
  projectCode,
  concessionCode,
  concessionName,
  holder,
  expiresAt,
  daysRemaining,
  region,
  areaHa,
  patentAmountClp,
  concessionId,
}: Props) => {
  const level: "danger" | "warn" = (daysRemaining ?? 0) <= 15 ? "danger" : "warn";
  const label =
    (daysRemaining ?? 0) < 0
      ? `VENCIDA HACE ${Math.abs(daysRemaining ?? 0)} DÍAS`
      : `VENCE EN ${daysRemaining} DÍAS`;
  return (
    <EmailLayout
      preview={`Concesión ${concessionCode ?? ""} ${label.toLowerCase()}`}
      audience="internal"
      ctaHref={appUrl(`/dashboard/catastro${concessionId ? `?id=${concessionId}` : ""}`)}
      ctaLabel="Abrir en el dashboard"
    >
      <Heading style={styles.h1}>
        {badge(level, label)} <span style={{ marginLeft: 6 }}>Acción requerida en catastro</span>
      </Heading>
      <Text style={styles.p}>
        Hola{recipientName ? ` ${recipientName}` : ""}, la siguiente concesión del proyecto{" "}
        <strong>{projectName ?? projectCode ?? "—"}</strong> requiere pago de patente o renovación.
      </Text>
      <KeyValueBlock
        rows={[
          ["Código", concessionCode],
          ["Nombre", concessionName],
          ["Titular", holder],
          ["Región", region],
          ["Superficie", areaHa ? `${areaHa} ha` : "—"],
          ["Vence", expiresAt],
          [
            "Patente estimada",
            patentAmountClp ? `CLP ${patentAmountClp.toLocaleString("es-CL")}` : "—",
          ],
        ]}
      />
      <Text style={styles.muted}>
        Esta alerta proviene del módulo de catastro de Geocapitals y se sincroniza con el boletín
        oficial de minería.
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: Email,
  subject: (d: Props) =>
    `[Catastro] ${d.concessionCode ?? "Concesión"} vence en ${d.daysRemaining ?? "?"} días · ${d.projectName ?? ""}`,
  displayName: "Catastro · Vencimiento (interno)",
  previewData: {
    recipientName: "Camila",
    projectName: "Palmeras Cu-Au",
    projectCode: "PALM-01",
    concessionCode: "07-A-123",
    concessionName: "PALMERA 1",
    holder: "Geocapitals SpA",
    expiresAt: "2026-08-31",
    daysRemaining: 12,
    region: "Coquimbo",
    areaHa: 300,
    patentAmountClp: 4500000,
  },
} satisfies TemplateEntry;
