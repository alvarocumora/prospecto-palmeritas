import { createServerFn } from "@tanstack/react-start";

export type MetalQuote = {
  code: string;
  name: string;
  /** Precio numérico en USD, en la unidad indicada por `unit` (oz o lb). */
  priceUsd: number | null;
  /** Precio formateado en USD (compat con UI antigua). */
  price: string;
  unit: string;
  updatedAt: string;
};

export type FxRates = {
  /** Cuántos CLP equivale 1 USD. */
  usdClp: number | null;
  fetchedAt: string;
};

const SYMBOLS: Array<{ sym: string; code: string; name: string; unit: string }> = [
  { sym: "XAU", code: "XAU", name: "Oro", unit: "USD/oz" },
  { sym: "XAG", code: "XAG", name: "Plata", unit: "USD/oz" },
  { sym: "HG", code: "HG", name: "Cobre", unit: "USD/lb" },
  { sym: "XPT", code: "XPT", name: "Platino", unit: "USD/oz" },
  { sym: "XPD", code: "XPD", name: "Paladio", unit: "USD/oz" },
];

function fmtUsd(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

async function fetchOne(sym: string): Promise<{ price: number; updatedAt: string } | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${sym}`, {
      headers: { "User-Agent": "geocapitals/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { price?: number; updatedAt?: string; error?: string };
    if (typeof j.price !== "number" || !Number.isFinite(j.price) || j.price <= 0 || j.error)
      return null;
    return { price: j.price, updatedAt: j.updatedAt ?? "" };
  } catch {
    return null;
  }
}

async function fetchUsdClp(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { rates?: Record<string, number> };
    const clp = j.rates?.CLP;
    return typeof clp === "number" && clp > 0 ? clp : null;
  } catch {
    return null;
  }
}

export const getMetalPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    quotes: MetalQuote[];
    fx: FxRates;
    fetchedAt: string;
  }> => {
    const [results, usdClp] = await Promise.all([
      Promise.all(SYMBOLS.map((s) => fetchOne(s.sym).then((r) => ({ meta: s, r })))),
      fetchUsdClp(),
    ]);
    const quotes: MetalQuote[] = results
      .filter((x) => x.r != null)
      .map(({ meta, r }) => ({
        code: meta.code,
        name: meta.name,
        unit: meta.unit,
        priceUsd: r!.price,
        price: fmtUsd(r!.price),
        updatedAt: r!.updatedAt,
      }));
    const now = new Date().toISOString();
    return { quotes, fx: { usdClp, fetchedAt: now }, fetchedAt: now };
  },
);
