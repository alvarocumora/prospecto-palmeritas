/**
 * Modelo canónico de documento de proyecto.
 * Un proyecto se describe una sola vez y las tres plantillas globales
 * (deck de inversión 16:9, one-pager y dossier técnico) leen de aquí.
 */
import type { BarDatum, MapPoint, Slice } from "./brand/kit";

export type DocKpi = { label: string; value: string; note?: string };

export type DocBlock =
  | { kind: "text"; body: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "kv"; items: Array<[string, string]> }
  | { kind: "table"; head: string[]; rows: string[][]; widths?: number[] };

export type DocSection = {
  /** Etiqueta corta sobre el título (eyebrow). */
  eyebrow: string;
  title: string;
  lead?: string;
  blocks: DocBlock[];
  /** Si es true, la plantilla de deck le dedica una lámina propia. */
  deck?: boolean;
};

export type ProjectDoc = {
  code: string;
  name: string;
  subtitle: string;
  commodity: string;
  stage: string;
  location: string;
  /** URL absoluta que codifica el QR (live map público). */
  liveUrl: string;
  docVersion: string;
  /** Etiquetas de portada (commodity, superficie, etapa…). */
  tags: string[];
  kpis: DocKpi[];
  thesis: string[];
  chart?: {
    title: string;
    caption?: string;
    unit?: string;
    labelA: string;
    labelB?: string;
    data: BarDatum[];
  };
  allocation?: {
    title: string;
    caption?: string;
    centerTop?: string;
    centerSub?: string;
    slices: Slice[];
  };
  map?: {
    title: string;
    caption?: string;
    points: MapPoint[];
    valueUnit?: string;

  };
  milestones?: Array<{ when: string; what: string }>;
  sections: DocSection[];
  disclaimers: string[];
  contact?: { name?: string; email?: string; phone?: string };
};

export type ProjectDocKind = "deck" | "onepager" | "technical";

export const DOC_KIND_LABEL: Record<ProjectDocKind, string> = {
  deck: "Deck de inversión (16:9)",
  onepager: "Resumen de una página",
  technical: "Dossier técnico",
};

export const DOC_KIND_FILE: Record<ProjectDocKind, string> = {
  deck: "Investor_Deck",
  onepager: "One_Pager",
  technical: "Technical_Brief",
};
