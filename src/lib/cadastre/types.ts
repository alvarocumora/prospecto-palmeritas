// Capa Catastral Universal — esquema canónico multi-país.
//
// Cada catastro nacional publica campos y estados distintos; este módulo los
// normaliza a UNA forma común para que búsqueda, fichas, watchlists y los
// motores (KYM, underwriting) operen igual en todos los países. Los conectores
// viven en ./connectors/* y se resuelven vía ./registry.

/** Países con conector implementado. Ampliar aquí al sumar fuentes. */
export type CadastreCountry = "CL" | "PE" | "BR" | "ZM";

export type NormalizedStatus = "active" | "pending" | "extinct" | "unknown";

/** Concesión minera en el esquema canónico de la plataforma. */
export type CanonicalConcession = {
  country: CadastreCountry;
  /** Identificador oficial en la fuente (rol, código único, processo…). */
  code: string;
  name: string | null;
  holder: string | null;
  /** Identificador tributario del titular si la fuente lo publica (RUT, RUC…). */
  holderTaxId: string | null;
  areaHa: number | null;
  /** Estado crudo tal como lo publica la fuente. */
  status: string | null;
  /** Estado normalizado para lógica de plataforma (alertas, KYM, filtros). */
  statusNormalized: NormalizedStatus;
  /** Tipo crudo (exploración/explotación/fase) si la fuente lo publica. */
  type: string | null;
  /** Sustancia/commodity si la fuente la publica (Brasil: SUBS; Zambia: Commodities). */
  commodity: string | null;
  /** Vencimiento si la fuente lo publica (ISO o texto crudo de la fuente). */
  expiresAt: string | null;
  /** Ubicación administrativa que publique la fuente (comuna, UF, zona). */
  location: string | null;
  /** Institución de origen del dato. */
  source: string;
  /** Visor oficial de la fuente, para citar/verificar. */
  sourceUrl: string | null;
};

/** Contrato de un conector de catastro nacional. */
export type CadastreConnector = {
  country: CadastreCountry;
  countryName: string;
  /** Institución oficial (SERNAGEOMIN, INGEMMET…). */
  institution: string;
  /** Búsqueda por nombre de concesión, titular o código. */
  search(term: string, limit: number): Promise<CanonicalConcession[]>;
};
