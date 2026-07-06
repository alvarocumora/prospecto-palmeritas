// Precios de metales para productores y vendedores.
//
// Fuente en vivo: mindicador.cl (precio libra de cobre del Banco Central de
// Chile — referencia BML/LME — y dólar observado). Es gratuita, sin API key y
// oficial. El precio del cobre alimenta el modelo ENAMI de poder de compra
// (src/lib/mining-economics.ts), reemplazando el valor estático anterior.

/** Libras (avoirdupois) por tonelada métrica. */
export const LB_PER_TONNE = 2204.6226;

export type MetalPrices = {
  cobreUsdLb: number; // USD por libra (referencia BML/LME)
  cobreUsdT: number; // USD por tonelada métrica de Cu fino
  cobreClpLb: number | null; // CLP por libra (si hay dólar)
  dolarClp: number | null; // CLP por USD (dólar observado)
  fecha: string | null; // fecha del dato de cobre (ISO)
  source: string;
  stale: boolean; // true si es fallback (no se pudo leer la fuente en vivo)
};

/** Convierte USD/lb → USD/tonelada métrica. */
export function usdLbToUsdT(usdLb: number): number {
  return usdLb * LB_PER_TONNE;
}

/**
 * Arma el objeto de precios a partir del valor de cobre (USD/lb) y el dólar.
 * `dolarClp` puede ser null (no se pudo leer); en ese caso cobreClpLb queda null.
 */
export function buildMetalPrices(
  cobreUsdLb: number,
  dolarClp: number | null,
  fecha: string | null,
  opts: { source?: string; stale?: boolean } = {},
): MetalPrices {
  return {
    cobreUsdLb,
    cobreUsdT: usdLbToUsdT(cobreUsdLb),
    cobreClpLb: dolarClp != null ? cobreUsdLb * dolarClp : null,
    dolarClp,
    fecha,
    source: opts.source ?? "Banco Central de Chile (BML) · mindicador.cl",
    stale: opts.stale ?? false,
  };
}

/** Extrae un valor numérico de un indicador de mindicador ({ valor, fecha }). */
export function readIndicator(
  root: unknown,
  key: string,
): { valor: number; fecha: string | null } | null {
  if (!root || typeof root !== "object") return null;
  const ind = (root as Record<string, unknown>)[key];
  if (!ind || typeof ind !== "object") return null;
  const valor = (ind as Record<string, unknown>).valor;
  const fecha = (ind as Record<string, unknown>).fecha;
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
  return { valor, fecha: typeof fecha === "string" ? fecha : null };
}

/** Parsea la respuesta raíz de mindicador.cl/api a MetalPrices, o null si falla. */
export function parseMindicador(root: unknown): MetalPrices | null {
  const cobre = readIndicator(root, "libra_cobre");
  if (!cobre) return null;
  const dolar = readIndicator(root, "dolar");
  return buildMetalPrices(cobre.valor, dolar?.valor ?? null, cobre.fecha);
}
