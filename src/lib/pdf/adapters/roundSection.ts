/**
 * Lámina "Ronda y cómo invertir" compartida por los decks de proyectos invertibles.
 * Valores de la ronda configurada por GeoCapitals (Admin → Rondas y tickets);
 * actualizar aquí si la ronda cambia.
 */
import type { DocSection } from "../model";

export function investmentRoundSection(o: { legalName: string; rut?: string }): DocSection {
  return {
    eyebrow: "Capital & Deals",
    title: "Ronda y cómo invertir",
    lead: "Explotación en curso de 5.000 a 15.000 t/mes (rango declarado por el titular).",
    deck: true,
    blocks: [
      {
        kind: "kv",
        items: [
          ["Sociedad", o.rut ? `${o.legalName} · RUT ${o.rut}` : o.legalName],
          ["Meta de la ronda", "USD 1.500.000"],
          ["Acciones ofrecidas", "15.000 a USD 100 por acción"],
          ["Ticket mínimo", "USD 25.000"],
        ],
      },
      {
        kind: "bullets",
        items: [
          "1. Perfil de inversionista en la plataforma: identidad, mandato y acuerdo de confidencialidad.",
          "2. Ticket: monto y acciones calculadas automáticamente.",
          "3. Contrato: lectura completa y firma manuscrita en web con sello QR.",
          "4. Depósito a la sociedad y envío del comprobante.",
          "5. Posición registrada y certificado de acciones con verificación QR.",
        ],
      },
    ],
  };
}
