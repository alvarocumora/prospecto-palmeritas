/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, appUrl, styles } from "./_shared";

interface Props {
  /** "created" (nuevo embarque) o "status" (cambio de estado). */
  kind?: "created" | "status";
  tradeRef?: string;
  commodity?: string;
  shipmentRef?: string;
  vesselName?: string;
  statusLabel?: string;
  route?: string;
  eta?: string;
  /** Path interno a la trazabilidad del trade (/dashboard/trades/:id). */
  trackingPath?: string;
}

const Email = ({
  kind,
  tradeRef,
  commodity,
  shipmentRef,
  vesselName,
  statusLabel,
  route,
  eta,
  trackingPath,
}: Props) => (
  <EmailLayout
    preview={
      kind === "created"
        ? `Nuevo embarque en tu operación ${tradeRef ?? ""}`
        : `Tu carga avanzó: ${statusLabel ?? ""}`
    }
    ctaHref={appUrl(trackingPath ?? "/dashboard/envios")}
    ctaLabel="Ver trazabilidad en vivo"
  >
    <Heading style={styles.h1}>
      {kind === "created" ? "Nuevo embarque en tu operación" : "Tu carga avanzó"}
    </Heading>
    <Text style={styles.p}>
      {kind === "created"
        ? `Tu contraparte creó un embarque para la operación ${tradeRef ?? ""}. Desde ahora puedes seguir la carga paso a paso.`
        : `El embarque de la operación ${tradeRef ?? ""} cambió de estado: ${statusLabel ?? ""}.`}
    </Text>
    <KeyValueBlock
      rows={[
        ["Operación", tradeRef],
        ["Commodity", commodity],
        ["Embarque", shipmentRef],
        ["Nave", vesselName],
        ["Ruta", route],
        ["ETA", eta],
        kind === "status" ? ["Nuevo estado", statusLabel] : ["Estado", statusLabel],
      ]}
    />
    <Text style={styles.muted}>
      La trazabilidad completa — etapas, documentos, embarques y mensajes — vive en la plataforma y
      se actualiza en tiempo real.
    </Text>
  </EmailLayout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d.kind === "created"
      ? `Geocapitals · Nuevo embarque en ${(d.tradeRef as string) ?? "tu operación"}`
      : `Geocapitals · Tu carga avanzó: ${(d.statusLabel as string) ?? ""}`,
  displayName: "Contraparte · Embarque actualizado",
  previewData: {
    kind: "status",
    tradeRef: "TRD-COBRE-01",
    commodity: "Concentrado de cobre",
    shipmentRef: "SHP-ABC123",
    vesselName: "MV Atacama",
    statusLabel: "En tránsito",
    route: "Puerto Angamos → Shanghai",
    eta: "12 de agosto de 2026",
    trackingPath: "/dashboard/envios",
  },
} satisfies TemplateEntry;
