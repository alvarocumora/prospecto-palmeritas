/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  highSeverityCount?: number;
  totalNew?: number;
  topIndex?: string;
  shareUrl?: string;
}

const Email = ({
  recipientName,
  projectName,
  highSeverityCount,
  totalNew,
  topIndex,
  shareUrl,
}: Props) => (
  <EmailLayout
    preview={`Nuevos targets satelitales · ${projectName ?? ""}`}
    audience="investor"
    ctaHref={shareUrl ?? appUrl("/inversionistas")}
    ctaLabel="Ver targets en el brief"
  >
    <Heading style={styles.h1}>Nuevos targets de exploración — {projectName ?? ""}</Heading>
    <Text style={styles.p}>
      Estimado/a {recipientName ?? "inversionista"}, el análisis multiespectral identificó nuevos
      blancos que validan el modelo geológico del proyecto. El equipo técnico priorizará los de
      mayor severidad para la próxima fase de campo.
    </Text>
    <KeyValueBlock
      rows={[
        ["Proyecto", projectName],
        ["Targets de alta prioridad", highSeverityCount],
        ["Targets totales detectados", totalNew],
        ["Firma espectral dominante", topIndex],
      ]}
    />
    <Text style={styles.muted}>
      Estos resultados provienen de procesamiento Sentinel-2/Landsat con índices litológicos y de
      alteración hidrotermal. Recibirás un update cuando se confirme con muestreo de terreno.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.highSeverityCount ?? 0} nuevos targets en ${d.projectName ?? "tu proyecto"}`,
  displayName: "Satelital · Brief inversionista",
  previewData: {
    recipientName: "María",
    projectName: "Cholqui Cu-Au-Ag",
    highSeverityCount: 3,
    totalNew: 7,
    topIndex: "iron_oxide",
  },
} satisfies TemplateEntry;
