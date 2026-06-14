/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, badge, styles } from "./_shared";

interface Props {
  recipientName?: string;
  projectName?: string;
  anomalyCount?: number;
  topScore?: number;
  topIndex?: string;
  topSeverity?: string;
  detectedAt?: string;
  runId?: string;
  projectId?: string;
}

const Email = ({
  recipientName,
  projectName,
  anomalyCount,
  topScore,
  topIndex,
  topSeverity,
  detectedAt,
  runId,
  projectId,
}: Props) => {
  const level = topSeverity === "high" ? "danger" : topSeverity === "medium" ? "warn" : "info";
  return (
    <EmailLayout
      preview={`${anomalyCount ?? 0} anomalías satelitales nuevas en ${projectName ?? ""}`}
      audience="internal"
      ctaHref={appUrl(`/dashboard/3d-pro${projectId ? `?project=${projectId}` : ""}`)}
      ctaLabel="Abrir visor 3D"
    >
      <Heading style={styles.h1}>
        {badge(level as "danger" | "warn" | "info", `${topSeverity?.toUpperCase() ?? "INFO"}`)}{" "}
        <span style={{ marginLeft: 6 }}>Nuevas anomalías satelitales</span>
      </Heading>
      <Text style={styles.p}>
        Hola{recipientName ? ` ${recipientName}` : ""}, el análisis satelital del proyecto{" "}
        <strong>{projectName ?? "—"}</strong> detectó {anomalyCount ?? 0} anomalías nuevas. Revisa
        los targets antes de planificar la próxima campaña.
      </Text>
      <KeyValueBlock
        rows={[
          ["Proyecto", projectName],
          ["Anomalías nuevas", anomalyCount],
          ["Score máximo", topScore ? topScore.toFixed(2) : "—"],
          ["Índice dominante", topIndex],
          ["Severidad máxima", topSeverity],
          ["Detectadas", detectedAt],
          ["Run", runId],
        ]}
      />
      <Text style={styles.muted}>
        Las anomalías se proyectan en WGS84 y pueden visualizarse extruidas a profundidad en el
        visor 3D junto con DEM Copernicus y drape Sentinel.
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: Email,
  subject: (d: Props) =>
    `[Satelital] ${d.anomalyCount ?? 0} anomalías nuevas en ${d.projectName ?? "proyecto"}`,
  displayName: "Satelital · Anomalías nuevas (interno)",
  previewData: {
    recipientName: "Diego",
    projectName: "Franco IOCG",
    anomalyCount: 7,
    topScore: 0.83,
    topIndex: "iron_oxide",
    topSeverity: "high",
    detectedAt: "2026-06-14",
    runId: "run_42",
  },
} satisfies TemplateEntry;
