// Mesa de Origen (Supply Desk): catálogos y helpers del pipeline
// demanda (mandatos) → red de proveedores → matching → trade.

export type MandateStatus = "draft" | "active" | "paused" | "fulfilled" | "closed";
export type MandateFrequency = "spot" | "monthly" | "quarterly" | "annual";
export type PartnerType = "producer" | "trader" | "aggregator" | "agent" | "refiner";
export type VettingStatus = "prospect" | "contacted" | "nda" | "docs_review" | "verified" | "rejected";
export type MatchStage =
  | "identified"
  | "contacted"
  | "ncnda"
  | "sampling"
  | "qualified"
  | "offer"
  | "allocated"
  | "trade"
  | "dropped";

export const MANDATE_STATUS_LABEL: Record<MandateStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "En pausa",
  fulfilled: "Cumplido",
  closed: "Cerrado",
};

export const MANDATE_FREQUENCY_LABEL: Record<MandateFrequency, string> = {
  spot: "Spot",
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
};

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  producer: "Productor",
  trader: "Trader",
  aggregator: "Agregador",
  agent: "Agente / finder",
  refiner: "Refinería",
};

export const VETTING_STATUS_LABEL: Record<VettingStatus, string> = {
  prospect: "Prospecto",
  contacted: "Contactado",
  nda: "NDA firmado",
  docs_review: "Docs en revisión",
  verified: "Verificado",
  rejected: "Rechazado",
};

/** Orden del pipeline de matching; `dropped` queda fuera del avance lineal. */
export const MATCH_STAGES: Array<{ key: MatchStage; label: string }> = [
  { key: "identified", label: "Identificado" },
  { key: "contacted", label: "Contactado" },
  { key: "ncnda", label: "NCNDA/NDA" },
  { key: "sampling", label: "Muestra · ensayo" },
  { key: "qualified", label: "Calificado" },
  { key: "offer", label: "Oferta (FCO)" },
  { key: "allocated", label: "Asignado" },
  { key: "trade", label: "Trade" },
];

export const MATCH_STAGE_LABEL: Record<MatchStage, string> = {
  ...Object.fromEntries(MATCH_STAGES.map((s) => [s.key, s.label])),
  dropped: "Descartado",
} as Record<MatchStage, string>;

export const matchStageIndex = (stage: string): number =>
  MATCH_STAGES.findIndex((s) => s.key === stage);

/** Etapas cuyo tonelaje ofrecido cuenta como cobertura firme del mandato. */
export const COVERAGE_STAGES: MatchStage[] = ["qualified", "offer", "allocated", "trade"];

/** Cobertura de un mandato: t comprometidas por matches calificados+. */
export function mandateCoverage(
  quantityT: number | null | undefined,
  matches: Array<{ stage: string; offered_quantity_t: number | null }>,
): { coveredT: number; pct: number | null } {
  const coveredT = matches
    .filter((m) => (COVERAGE_STAGES as string[]).includes(m.stage))
    .reduce((acc, m) => acc + (m.offered_quantity_t ?? 0), 0);
  const pct = quantityT && quantityT > 0 ? Math.min(100, Math.round((coveredT / quantityT) * 100)) : null;
  return { coveredT, pct };
}

/** Plantillas de mandato basadas en la demanda real recibida por la mesa. */
export const MANDATE_TEMPLATES: Array<{
  key: string;
  label: string;
  values: {
    title: string;
    commodity: string;
    form: string;
    spec: string;
    destination: string;
    frequency: MandateFrequency;
    incoterm: string;
    paymentInstrument: string;
    priceBasis: string;
  };
}> = [
  {
    key: "sb-florida",
    label: "Antimonio → refinería Florida (USA)",
    values: {
      title: "Antimonio para refinería en Florida, USA",
      commodity: "Sb",
      form: "concentrate",
      spec: "Concentrado/mineral de Sb; indicar ley %Sb, As y Pb máximos según ficha de la refinería",
      destination: "Refinería, Florida, USA",
      frequency: "monthly",
      incoterm: "CIF",
      paymentInstrument: "dlc",
      priceBasis: "Rotterdam Sb 99.65% menos descuento por tratamiento",
    },
  },
  {
    key: "cu-cathode",
    label: "Cátodo de cobre Grado A",
    values: {
      title: "Cátodo de cobre Grado A (LME)",
      commodity: "Cu",
      form: "cathode",
      spec: "Cátodo Cu 99.99% Grado A registrado LME; certificado de origen y assay por lote",
      destination: "USA",
      frequency: "monthly",
      incoterm: "CIF",
      paymentInstrument: "sblc_mt760",
      priceBasis: "LME Cash menos descuento negociado",
    },
  },
  {
    key: "cu-concentrate",
    label: "Concentrado de cobre",
    values: {
      title: "Concentrado de cobre",
      commodity: "Cu",
      form: "concentrate",
      spec: "Concentrado Cu ≥20%; indicar As/Sb penalizables; assay SGS/Alex Stewart",
      destination: "USA",
      frequency: "monthly",
      incoterm: "FOB",
      paymentInstrument: "dlc",
      priceBasis: "LME menos TC/RC",
    },
  },
  {
    key: "au-dore",
    label: "Oro bullion / doré",
    values: {
      title: "Oro en bullion o doré",
      commodity: "Au",
      form: "dore",
      spec: "Doré ≥85% Au o bullion 995+; ensaye por refinería, cadena de custodia y origen documentado",
      destination: "USA",
      frequency: "monthly",
      incoterm: "CIF",
      paymentInstrument: "escrow",
      priceBasis: "LBMA PM menos descuento",
    },
  },
];

export const COMMODITY_FORMS: Array<{ key: string; label: string }> = [
  { key: "concentrate", label: "Concentrado" },
  { key: "cathode", label: "Cátodos" },
  { key: "ore", label: "Mineral" },
  { key: "dore", label: "Doré" },
  { key: "bullion", label: "Bullion" },
  { key: "ingot", label: "Lingote" },
];
