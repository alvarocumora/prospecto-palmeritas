// Lógica pura de las API keys del catastro unificado (data-as-a-product).
// Generación/formato/hash de llaves y control de cuota mensual por plan.
// El server fn (apiKeys.functions.ts) y la ruta pública (api/v1) la consumen.

export const API_KEY_PREFIX = "gc_live_";

/** Cuota mensual de requests por plan. */
export const API_PLAN_LIMITS: Record<string, number> = {
  free: 1000,
  pro: 50_000,
  enterprise: 1_000_000,
};

/** Genera una llave nueva con el CSPRNG de la plataforma (32 bytes → hex). */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${API_KEY_PREFIX}${hex}`;
}

/** ¿Tiene la forma de una llave nuestra? (formato, no validez). */
export function isApiKeyFormat(key: string): boolean {
  return new RegExp(`^${API_KEY_PREFIX}[0-9a-f]{64}$`).test(key);
}

/** Prefijo para display: "gc_live_a1b2c3…". */
export function keyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + 6);
}

/** SHA-256 hex de la llave (lo único que se persiste). */
export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Clave de mes "YYYY-MM" para el contador de cuota. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type QuotaCheck = {
  allowed: boolean;
  limit: number;
  /** Contador vigente tras considerar el cambio de mes. */
  effectiveCount: number;
  /** true si el contador debe reiniciarse (cambió el mes). */
  resetCounter: boolean;
};

/**
 * Evalúa la cuota mensual de una llave. Si el mes almacenado difiere del
 * actual, el contador efectivo es 0 y debe reiniciarse al persistir.
 */
export function checkQuota(
  plan: string,
  storedMonthKey: string | null,
  storedMonthlyCount: number,
  now: Date,
): QuotaCheck {
  const limit = API_PLAN_LIMITS[plan] ?? API_PLAN_LIMITS.free;
  const current = monthKey(now);
  const sameMonth = storedMonthKey === current;
  const effectiveCount = sameMonth ? storedMonthlyCount : 0;
  return {
    allowed: effectiveCount < limit,
    limit,
    effectiveCount,
    resetCounter: !sameMonth,
  };
}
