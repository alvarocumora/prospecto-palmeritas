// Sourcing de commodities (lógica pura): un comprador/gestor registra un
// requerimiento, comparte un link para que un asociado/proveedor suba su
// propuesta, y luego genera una ficha de proveedor para compartir con el
// comprador final. Tokens públicos: solo se persiste su hash.

export const SOURCING_SUBMIT_PREFIX = "gcsrc_"; // link para el proveedor
export const SOURCING_SHARE_PREFIX = "gcshr_"; // ficha para el comprador

function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateSubmitToken(): string {
  return `${SOURCING_SUBMIT_PREFIX}${randomHex()}`;
}
export function generateShareToken(): string {
  return `${SOURCING_SHARE_PREFIX}${randomHex()}`;
}

export function isSubmitTokenFormat(token: string): boolean {
  return new RegExp(`^${SOURCING_SUBMIT_PREFIX}[0-9a-f]{64}$`).test(token);
}
export function isShareTokenFormat(token: string): boolean {
  return new RegExp(`^${SOURCING_SHARE_PREFIX}[0-9a-f]{64}$`).test(token);
}

export function tokenPrefix(token: string): string {
  const us = token.indexOf("_");
  return token.slice(0, (us < 0 ? 5 : us + 1) + 6);
}

// ---------- Estados ----------
export const REQUEST_STATUSES = ["abierto", "cerrado"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SUBMISSION_STATUSES = ["recibida", "preseleccionada", "descartada"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  recibida: "Recibida",
  preseleccionada: "Preseleccionada",
  descartada: "Descartada",
};

// ---------- Resumen de propuestas ----------
export type SubmissionLike = {
  status: string;
  offer_price_usd_t: number | null;
};

export type SubmissionsSummary = {
  total: number;
  shortlisted: number;
  /** Mejor (menor) precio ofertado entre propuestas no descartadas. */
  bestPriceUsdT: number | null;
};

export function summarizeSubmissions(rows: SubmissionLike[]): SubmissionsSummary {
  let shortlisted = 0;
  let best: number | null = null;
  for (const r of rows) {
    if (r.status === "descartada") continue;
    if (r.status === "preseleccionada") shortlisted += 1;
    if (r.offer_price_usd_t != null && Number.isFinite(r.offer_price_usd_t)) {
      best = best == null ? r.offer_price_usd_t : Math.min(best, r.offer_price_usd_t);
    }
  }
  return { total: rows.length, shortlisted, bestPriceUsdT: best };
}
