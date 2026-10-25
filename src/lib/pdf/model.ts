/**
 * Modelo canónico de documento de proyecto.
 * Un proyecto se describe una sola vez y las plantillas globales leen desde aquí.
 */
import type { GeoSnapshotManifest } from "@/lib/geospatial/snapshotManifest";
import type { BarDatum, MapPoint, MapPolygon, Slice } from "./brand/kit";
import type { EvidenceClass, ReportProfile } from "./architecture";
import type { DisclosureStandard } from "@/lib/reports/internationalStandards";

export type DocKpi = { label: string; value: string; note?: string };

/** Visual marketing pages share their content with the public presentation. */
export type InvestorVisualSlide = {
  title: string;
  kicker: string;
  lead: string;
  image: string;
  imageLabel: string;
  hero?: boolean;
  stats: DocKpi[];
  items: Array<{ title: string; body: string }>;
  note: string;
  /** Ficha de inversión superpuesta (proyecto con ronda abierta). */
  ficha?: {
    project: string;
    commodity: string;
    placement: number;
    valuation: string;
    horizon: string;
  };
};

export type EvidenceStatus =
  "VERIFIED" | "OBSERVED" | "DECLARED" | "DERIVED" | "CONCEPTUAL" | "PENDING_DD";

export type DocConfidence = "high" | "medium" | "low";

export type DataQualityFlag = {
  status: EvidenceStatus;
  label: string;
  detail: string;
  /** Canonical provenance class used by Report Architecture v4. */
  provenance?: EvidenceClass;
  source?: string;
  confidence?: DocConfidence;
};

export type DocBlockMeta = {
  provenance?: EvidenceClass;
  source?: string;
  confidence?: DocConfidence;
};

export type DocBlock =
  | ({ kind: "narrative"; body: string } & DocBlockMeta)
  | ({ kind: "finding"; title: string; body: string } & DocBlockMeta)
  | ({
      kind: "evidence";
      label: string;
      body: string;
      provenance: EvidenceClass;
      confidence?: DocConfidence;
      source?: string;
    } & DocBlockMeta)
  | ({
      kind: "figure";
      title: string;
      imageDataUrl: string;
      caption?: string;
    } & DocBlockMeta)
  | ({
      kind: "map";
      title: string;
      imageDataUrl: string;
      caption?: string;
      crs?: string;
      imagery?: string;
      /** Runtime viewer evidence manifest captured with the same map image. */
      snapshotManifest?: GeoSnapshotManifest;
    } & DocBlockMeta)
  | { kind: "gap"; title: string; body: string; action?: string }
  | { kind: "recommendation"; title: string; body: string; priority?: "high" | "medium" | "low" }
  | ({
      kind: "appendixTable";
      title: string;
      head: string[];
      rows: string[][];
      widths?: number[];
    } & DocBlockMeta)
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
  /** Restricts a section to compatible report narratives. Undefined means reusable. */
  profiles?: ReportProfile[];
};

export type ProjectDoc = {
  /** Narrative contract. Defaults to technical for backwards compatibility. */
  reportProfile?: ReportProfile;
  /** Review framework only; never a certification or compliance claim. */
  disclosureStandard?: DisclosureStandard;
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
    polygons?: MapPolygon[];
    valueUnit?: string;
    captureSelector?: string;
    imageDataUrl?: string;
    source?: string;
    crs?: string;
    imagery?: string;
    snapshotManifest?: GeoSnapshotManifest;
    /** Capturas temáticas del visor 2D activo para anexar al informe técnico/deck. */
    capturePresets?: Array<"remote_sensing" | "geophysics">;
  };
  dataQuality?: DataQualityFlag[];
  milestones?: Array<{ when: string; what: string }>;
  sections: DocSection[];
  visualSlides?: InvestorVisualSlide[];
  disclaimers: string[];
  contact?: { name?: string; email?: string; phone?: string };
};

export type ProjectDocKind = "deck" | "onepager" | "technical";

export const DOC_KIND_LABEL: Record<ProjectDocKind, string> = {
  deck: "Deck de inversión (16:9)",
  onepager: "Resumen de una página",
  technical: "Informe técnico preliminar",
};

export const DOC_KIND_FILE: Record<ProjectDocKind, string> = {
  deck: "Investor_Deck",
  onepager: "One_Pager",
  technical: "Technical_Brief",
};
