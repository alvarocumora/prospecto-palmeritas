/**
 * Research document system (Investment Memorandum, Asset Fact Sheet,
 * Technical Evidence Report…). One model feeds the in-app preview and the
 * PDF export; every figure carries provenance and a source reference.
 */
import type { RGB } from "../brand/tokens";

/** Mineral Capital palette (2026-10) — matches platform --im-* tokens. */
export const RS_COLOR = {
  paper: [250, 248, 243] as RGB, // blanco cálido
  ink: [15, 30, 61] as RGB, // navy profundo #0F1E3D
  muted: [92, 102, 122] as RGB, // navy secundario
  hairline: [227, 222, 210] as RGB,
  /** Acento (cobre mineral). Nombre legacy conservado por compatibilidad. */
  cobalt: [168, 106, 58] as RGB, // #A86A3A
  gold: [201, 164, 92] as RGB, // #C9A45C
  white: [255, 255, 255] as RGB,
} as const;

/** Minimum legible sizes (pt). Tests assert nothing is drawn below `note`. */
export const RS_TYPE = { note: 7.5, body: 8.5, deckBody: 9 } as const;

export type Provenance =
  "MEDIDO" | "OFICIAL" | "DECLARADO" | "MODELADO" | "REFERENCIAL" | "PENDIENTE";

export type ResearchSource = {
  id: string;
  label: string;
  /** Período o fecha de los datos; "No informado" si la fuente no lo trae. */
  period: string;
  provenance: Provenance;
};

export type ResearchParam = {
  label: string;
  value: string;
  provenance: Provenance;
  sourceId: string;
  note?: string;
  /** Links to a Discrepancy; renders as REVISIÓN / DATO POR CONFIRMAR. */
  conflictId?: string;
};

export type Discrepancy = {
  id: string;
  project: string;
  field: string;
  documentValue: string;
  documentSource: string;
  platformValue: string;
  platformSource: string;
  /** Blocking discrepancies prevent any public export. */
  blocking: boolean;
};

export type ResearchMap = {
  imageUrl: string;
  imageDataUrl?: string;
  /** width / height of the stored image. */
  aspect: number;
  caption: string;
  sourceId: string;
  crs: string;
  extent: string;
  retrieved: string;
  acquisition: string;
  attribution: string;
};

export type ResearchFamily = "memo" | "factsheet" | "technical" | "quarterly" | "statement";

export type RiskRow = {
  area: string;
  risk: string;
  level: "Alto" | "Medio" | "Bajo";
  status: string;
};

export type ResearchDoc = {
  family: ResearchFamily;
  code: string;
  title: string;
  category: string;
  projectName: string;
  subtitle: string;
  issued: string;
  version: string;
  classification: string;
  /** Draft documents are watermarked as internal tests. */
  draft: boolean;
  thesis: string;
  findings: string[];
  strengths: string[];
  uncertainties: string[];
  nextSteps: string[];
  params: ResearchParam[];
  /** Equity round terms only. The collateralised loan is a separate instrument. */
  terms: ResearchParam[];
  termsIssuer?: string;
  assays?: {
    head: string[];
    rows: string[][];
    numericCols: number[];
    sourceIds: string[];
    note: string;
  };
  assayStats?: ResearchParam[];
  map?: ResearchMap;
  risks: RiskRow[];
  dueDiligence: Array<{ item: string; status: string }>;
  sources: ResearchSource[];
  discrepancies: Discrepancy[];
  disclaimers: string[];
  separateInstrumentNote?: string;
};

export const FAMILY_LABEL: Record<ResearchFamily, string> = {
  memo: "Investment Memorandum",
  factsheet: "Asset Fact Sheet",
  technical: "Technical Evidence Report",
  quarterly: "Quarterly Investor Update",
  statement: "Investor Statement",
};

export const CONFLICT_LABEL = "REVISIÓN / DATO POR CONFIRMAR";

/** Integrity: every referenced source must exist; returns human-readable problems. */
export function integrityProblems(doc: ResearchDoc): string[] {
  const ids = new Set(doc.sources.map((s) => s.id));
  const problems: string[] = [];
  const check = (p: ResearchParam) => {
    if (!ids.has(p.sourceId)) problems.push(`Sin fuente: ${p.label}`);
    if (p.conflictId && !doc.discrepancies.some((d) => d.id === p.conflictId))
      problems.push(`Discrepancia no registrada: ${p.label}`);
  };
  [...doc.params, ...doc.terms, ...(doc.assayStats ?? [])].forEach(check);
  doc.assays?.sourceIds.forEach(
    (id) => !ids.has(id) && problems.push(`Sin fuente de ensaye: ${id}`),
  );
  if (doc.map && !ids.has(doc.map.sourceId)) problems.push("Mapa sin fuente");
  return problems;
}

export function publicExportBlocked(doc: ResearchDoc): boolean {
  return doc.discrepancies.some((d) => d.blocking) || integrityProblems(doc).length > 0;
}
