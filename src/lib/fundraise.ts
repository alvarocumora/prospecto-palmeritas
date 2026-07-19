// Levantamiento de capital de un proyecto (lógica pura): instrumentos, estados,
// validación del uso de fondos y valorización implícita a partir del monto de
// la ronda y el % ofrecido. Refleja la forma de ProjectFicha (investor/fichas)
// para que la ficha y el simulador puedan leer de DB sin fricción. Testeable.

// ---------- Token público de la ficha (share link) ----------
// Solo se persiste el hash; el token viaja en claro una única vez al generarlo.
export const FUNDRAISE_TOKEN_PREFIX = "gcprj_";

function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateFundraiseToken(): string {
  return `${FUNDRAISE_TOKEN_PREFIX}${randomHex()}`;
}

export function isFundraiseTokenFormat(token: string): boolean {
  return new RegExp(`^${FUNDRAISE_TOKEN_PREFIX}[0-9a-f]{64}$`).test(token);
}

export function fundraiseTokenPrefix(token: string): string {
  return token.slice(0, FUNDRAISE_TOKEN_PREFIX.length + 6);
}

export const FUNDRAISE_INSTRUMENTS = [
  "equity",
  "safe",
  "convertible",
  "option_nsr",
  "jv_farmin",
  "debt",
  "other",
] as const;
export type FundraiseInstrument = (typeof FUNDRAISE_INSTRUMENTS)[number];

export const FUNDRAISE_INSTRUMENT_LABELS: Record<FundraiseInstrument, string> = {
  equity: "Equity / participación",
  safe: "SAFE",
  convertible: "Nota convertible",
  option_nsr: "Opción + regalía NSR",
  jv_farmin: "JV / farm-in",
  debt: "Deuda",
  other: "Otro",
};

export const FUNDRAISE_STATUSES = ["draft", "open", "closed"] as const;
export type FundraiseStatus = (typeof FUNDRAISE_STATUSES)[number];

export const FUNDRAISE_STATUS_LABELS: Record<FundraiseStatus, string> = {
  draft: "Borrador",
  open: "Abierta",
  closed: "Cerrada",
};

export type UseOfFund = { label: string; pct: number };
export type Milestone = { when: string; what: string };
export type FundraiseScenario = { key: string; label: string; multiple: number; note: string };

export type FundraiseData = {
  roundSizeUsd: number | null;
  minTicketUsd: number | null;
  instrument: FundraiseInstrument | null;
  equityOfferedPct: number | null;
  horizonYears: number | null;
  valuationLowUsd: number | null;
  valuationHighUsd: number | null;
  valuationMethod: string | null;
  financingStructure: string | null;
  useOfFunds: UseOfFund[];
  milestones: Milestone[];
  scenarios: FundraiseScenario[];
  highlights: string[];
  notes: string | null;
  status: FundraiseStatus;
  isPublic: boolean;
};

export function normalizeInstrument(v: string | null | undefined): FundraiseInstrument | null {
  const s = (v ?? "").toLowerCase().trim();
  return (FUNDRAISE_INSTRUMENTS as readonly string[]).includes(s)
    ? (s as FundraiseInstrument)
    : null;
}

export function normalizeStatus(v: string | null | undefined): FundraiseStatus {
  const s = (v ?? "").toLowerCase().trim();
  return (FUNDRAISE_STATUSES as readonly string[]).includes(s) ? (s as FundraiseStatus) : "draft";
}

/** Suma de porcentajes del uso de fondos (0 si vacío). */
export function totalAllocationPct(rows: UseOfFund[]): number {
  return rows.reduce((a, r) => a + (Number.isFinite(r.pct) ? r.pct : 0), 0);
}

export type UseOfFundsValidation = { ok: boolean; totalPct: number; error: string | null };

/** El uso de fondos es válido si no supera 100% y cada línea está en [0,100]. */
export function validateUseOfFunds(rows: UseOfFund[]): UseOfFundsValidation {
  for (const r of rows) {
    if (!Number.isFinite(r.pct) || r.pct < 0 || r.pct > 100) {
      return {
        ok: false,
        totalPct: totalAllocationPct(rows),
        error: "Cada línea debe estar entre 0 y 100%.",
      };
    }
  }
  const total = totalAllocationPct(rows);
  if (total > 100.0001) {
    return { ok: false, totalPct: total, error: "El uso de fondos supera el 100%." };
  }
  return { ok: true, totalPct: total, error: null };
}

/** Valorización post-money implícita = monto ronda / (% ofrecido / 100). */
export function impliedPostMoneyUsd(
  roundSizeUsd: number | null,
  equityOfferedPct: number | null,
): number | null {
  if (roundSizeUsd == null || equityOfferedPct == null) return null;
  if (!(equityOfferedPct > 0)) return null;
  return roundSizeUsd / (equityOfferedPct / 100);
}

/** Valorización pre-money implícita = post-money − monto de la ronda. */
export function impliedPreMoneyUsd(
  roundSizeUsd: number | null,
  equityOfferedPct: number | null,
): number | null {
  const post = impliedPostMoneyUsd(roundSizeUsd, equityOfferedPct);
  if (post == null || roundSizeUsd == null) return null;
  return Math.max(0, post - roundSizeUsd);
}

/** Valor proyectado de un ticket al horizonte según el múltiplo del escenario. */
export function ticketOutcomeUsd(ticketUsd: number, scenario: FundraiseScenario): number {
  return ticketUsd * (Number.isFinite(scenario.multiple) ? scenario.multiple : 0);
}

/** Todos los proyectos son operados por Geocapitals. */
export const PROJECT_OPERATOR = "Geocapitals";

/** Escenarios de retorno estándar (MOIC) cuando la ronda no define los propios. */
export const DEFAULT_INVESTMENT_SCENARIOS: FundraiseScenario[] = [
  {
    key: "conservador",
    label: "Conservador",
    multiple: 1.6,
    note: "Avance parcial; salida temprana del activo.",
  },
  {
    key: "base",
    label: "Base",
    multiple: 3,
    note: "Cumple hitos; reventa o farm-out con recursos definidos.",
  },
  {
    key: "optimista",
    label: "Optimista",
    multiple: 6,
    note: "Descubrimiento relevante; entra un socio estratégico o major.",
  },
];

/** Escenarios a mostrar: los de la ronda si existen, si no los estándar. */
export function resolveScenarios(scenarios: FundraiseScenario[]): FundraiseScenario[] {
  return scenarios.length > 0 ? scenarios : DEFAULT_INVESTMENT_SCENARIOS;
}

/** ¿La ronda tiene lo mínimo para publicarse? (monto, ticket e instrumento). */
export function isFundraisePublishable(d: FundraiseData): boolean {
  return (
    d.roundSizeUsd != null &&
    d.roundSizeUsd > 0 &&
    d.minTicketUsd != null &&
    d.minTicketUsd > 0 &&
    d.instrument != null
  );
}
