/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, KeyValueBlock, badge, styles } from "./_shared";

interface Props {
  counterpartyName?: string;
  tradeRef?: string;
  commodity?: string;
  amount?: string;
  dueDate?: string;
  /** "upcoming" | "overdue" | "severe" */
  stage?: string;
  daysOverdue?: number;
  fromName?: string;
}

function stageBadge(stage?: string, daysOverdue?: number) {
  if (stage === "severe") return badge("danger", `VENCIDO ${daysOverdue ?? ""}D`);
  if (stage === "overdue") return badge("warn", `VENCIDO ${daysOverdue ?? ""}D`);
  return badge("info", "PRÓXIMO A VENCER");
}

const Email = ({
  counterpartyName,
  tradeRef,
  commodity,
  amount,
  dueDate,
  stage,
  daysOverdue,
  fromName,
}: Props) => {
  const overdue = stage === "overdue" || stage === "severe";
  return (
    <EmailLayout
      preview={
        overdue
          ? `Pago vencido en tu operación ${tradeRef ?? ""}`
          : `Pago próximo a vencer en tu operación ${tradeRef ?? ""}`
      }
    >
      <Heading style={styles.h1}>
        {overdue ? "Recordatorio de pago vencido" : "Recordatorio de pago próximo"}
      </Heading>
      <Text style={styles.p}>
        Hola{counterpartyName ? ` ${counterpartyName}` : ""}, {stageBadge(stage, daysOverdue)}
      </Text>
      <Text style={styles.p}>
        {overdue
          ? `Registramos un pago pendiente y ya vencido en tu operación${tradeRef ? ` ${tradeRef}` : ""}. Te agradeceremos regularizarlo a la brevedad o coordinar con tu contraparte.`
          : `Este es un recordatorio de un pago próximo a vencer en tu operación${tradeRef ? ` ${tradeRef}` : ""}.`}
      </Text>
      <KeyValueBlock
        rows={
          [
            ["Operación", tradeRef],
            ["Commodity", commodity],
            ["Monto", amount],
            ["Vencimiento", dueDate],
            overdue
              ? ["Días de mora", daysOverdue != null ? String(daysOverdue) : undefined]
              : null,
          ].filter(Boolean) as Array<[string, string | number | null | undefined]>
        }
      />
      <Text style={styles.muted}>
        {fromName ? `Enviado en nombre de ${fromName}. ` : ""}Si ya realizaste el pago, ignora este
        aviso. Ante cualquier duda, responde a este correo para coordinar.
      </Text>
    </EmailLayout>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const ref = (d.tradeRef as string) ?? "tu operación";
    const overdue = d.stage === "overdue" || d.stage === "severe";
    return overdue
      ? `Geocapitals · Pago vencido en ${ref}`
      : `Geocapitals · Pago próximo a vencer en ${ref}`;
  },
  displayName: "Cobranza · Recordatorio de pago",
  previewData: {
    counterpartyName: "Comercial Andes",
    tradeRef: "TRD-COBRE-01",
    commodity: "Concentrado de cobre",
    amount: "US$ 120.000",
    dueDate: "10 de julio de 2026",
    stage: "overdue",
    daysOverdue: 8,
    fromName: "Geocapitals",
  },
} satisfies TemplateEntry;
