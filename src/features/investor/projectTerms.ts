// Términos institucionales por proyecto: tenencia, valuación de referencia y entrega de material.
// Cifras declaradas por el titular / términos de ronda; no son recursos certificados.
import { ROUND } from "./pendingTicket";

export const SPV_ROUND_EQUITY_PCT = 10; // la ronda representa el 10 % del capital de la SPV
export const REFERENCE_VALUATION_USD = ROUND.target / (SPV_ROUND_EQUITY_PCT / 100); // USD 15.000.000

export type ProjectTerms = {
  slug: "cholqui" | "losverdes";
  series: string;
  hectares: { direct: number; district: number; detail: string };
  delivery: string[];
};

export const PROJECT_TERMS: Record<ProjectTerms["slug"], ProjectTerms> = {
  cholqui: {
    slug: "cholqui",
    series: "Acciones Serie Preferente · SPV Cholqui",
    hectares: {
      direct: 1294,
      district: 5000,
      detail: "TOKI 1–8, PALLOCABE 1–6, DOS MARÍAS 1–2",
    },
    delivery: ["Planta Catemu (CEMIN)", "Poder de compra ENAMI Rancagua"],
  },
  losverdes: {
    slug: "losverdes",
    series: "Acciones Serie Preferente · SPV Tilama (Los Verdes)",
    hectares: {
      direct: 1963,
      district: 2600,
      detail: "17 pertenencias catastradas + 637 ha en anexos",
    },
    delivery: ["Poder de compra ENAMI Cabildo / Illapel", "Planta de beneficio regional (Choapa)"],
  },
};

/** Porcentaje del capital total de la SPV que representa un número de acciones de la ronda. */
export function pctOfSpvCapital(shares: number, roundShares = ROUND.shares): number {
  return (shares / roundShares) * SPV_ROUND_EQUITY_PCT;
}

export function seriesForCode(code: string): string {
  return code === "CHOLQUI" ? PROJECT_TERMS.cholqui.series : PROJECT_TERMS.losverdes.series;
}
