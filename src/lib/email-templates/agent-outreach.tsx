/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailLayout, styles } from "./_shared";

interface Props {
  subject?: string;
  body?: string;
  fromName?: string;
}

const Email = ({ subject, body, fromName }: Props) => {
  const paragraphs = (body ?? "").split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <EmailLayout preview={subject ?? "Mensaje de Geocapitals"}>
      {subject ? <Heading style={styles.h1}>{subject}</Heading> : null}
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.p}>
          {p.split(/\n/).map((line, j) => (
            <React.Fragment key={j}>
              {line}
              {j < p.split(/\n/).length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ))}
      <Text style={styles.muted}>{fromName ?? "Equipo Geocapitals"}</Text>
    </EmailLayout>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    (d.subject as string)?.trim() || "Geocapitals · mensaje de tu operación",
  displayName: "Agente · Mensaje de contacto",
  previewData: {
    subject: "Avancemos con la operación de antimonio",
    body: "Estimado Vincent,\n\nQuedamos atentos para coordinar el siguiente paso de la operación SB-ANTIMONIO. ¿Podemos avanzar con la FCO esta semana?\n\nSaludos,",
    fromName: "Equipo Geocapitals",
  },
} satisfies TemplateEntry;
