/**
 * Compares the commercial dossier (Oct 2026, transcribed in deck2026) with
 * platform records. Nothing is reconciled silently: conflicts are reported
 * and block public export until resolved by a person.
 */
import { DECK_TERMS } from "@/features/marketing/deck/deck2026";
import { CHOLQUI_ASSAYS, CHOLQUI_ROUND } from "@/features/franco/data/cholqui";
import { FICHAS } from "@/lib/investor/fichas";
import type { Discrepancy } from "./model";

const DOSSIER = "Dossier comercial octubre 2026";
const usd = (n: number) => `USD ${n.toLocaleString("es-CL")}`;

/** Sample count stated in the dossier ("siete análisis puntuales"). */
export const DOSSIER_CHOLQUI_SAMPLES = 7;

export function findDiscrepancies(project: "cholqui" | "losverdes"): Discrepancy[] {
  const out: Discrepancy[] = [];
  if (project === "cholqui") {
    if (DECK_TERMS.roundUsd !== CHOLQUI_ROUND.roundSizeUsd)
      out.push({
        id: "cholqui-round-size",
        project: "Cholqui",
        field: "Tamaño de la ronda",
        documentValue: usd(DECK_TERMS.roundUsd),
        documentSource: DOSSIER,
        platformValue: usd(CHOLQUI_ROUND.roundSizeUsd),
        platformSource: "Términos referenciales de la plataforma (CHOLQUI_ROUND)",
        blocking: true,
      });
    if (CHOLQUI_ASSAYS.length !== DOSSIER_CHOLQUI_SAMPLES)
      out.push({
        id: "cholqui-sample-count",
        project: "Cholqui",
        field: "Número de análisis puntuales",
        documentValue: `${DOSSIER_CHOLQUI_SAMPLES} muestras`,
        documentSource: DOSSIER,
        platformValue: `${CHOLQUI_ASSAYS.length} muestras`,
        platformSource: "Ensayes registrados en la plataforma (Andes Analytical / FGF)",
        blocking: true,
      });
    if (DECK_TERMS.minUsd !== CHOLQUI_ROUND.minTicketUsd)
      out.push({
        id: "cholqui-min-ticket",
        project: "Cholqui",
        field: "Ticket mínimo",
        documentValue: usd(DECK_TERMS.minUsd),
        documentSource: DOSSIER,
        platformValue: usd(CHOLQUI_ROUND.minTicketUsd),
        platformSource: "Términos referenciales de la plataforma",
        blocking: true,
      });
  } else {
    const lv = FICHAS.losverdes;
    if (DECK_TERMS.minUsd !== lv.minTicketUsd)
      out.push({
        id: "losverdes-min-ticket",
        project: "Los Verdes – Tilama",
        field: "Ticket mínimo",
        documentValue: usd(DECK_TERMS.minUsd),
        documentSource: DOSSIER,
        platformValue: usd(lv.minTicketUsd),
        platformSource: "Ficha de inversión de la plataforma",
        blocking: true,
      });
    if (DECK_TERMS.roundUsd !== lv.roundSizeUsd)
      out.push({
        id: "losverdes-round-size",
        project: "Los Verdes – Tilama",
        field: "Tamaño de la ronda",
        documentValue: usd(DECK_TERMS.roundUsd),
        documentSource: DOSSIER,
        platformValue: usd(lv.roundSizeUsd),
        platformSource: "Ficha de inversión de la plataforma",
        blocking: true,
      });
    out.push({
      id: "losverdes-commodity",
      project: "Los Verdes – Tilama",
      field: "Commodity",
      documentValue: "Cu (portada) / Cu–Mo (ficha)",
      documentSource: DOSSIER,
      platformValue: lv.commodity,
      platformSource: "Ficha de inversión de la plataforma",
      blocking: false,
    });
  }
  return out;
}
