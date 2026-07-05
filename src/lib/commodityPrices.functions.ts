import { createServerFn } from "@tanstack/react-start";

export type MetalQuote = {
  code: string;
  name: string;
  price: string;
  unit: string;
  updatedAt: string;
};

const SYMBOLS: Array<{ sym: string; code: string; name: string; unit: string }> = [
  { sym: "XAU", code: "XAU", name: "Oro", unit: "USD/oz" },
  { sym: "XAG", code: "XAG", name: "Plata", unit: "USD/oz" },
  { sym: "HG", code: "HG", name: "Cobre", unit: "USD/lb" },
  { sym: "XPT", code: "XPT", name: "Platino", unit: "USD/oz" },
  { sym: "XPD", code: "XPD", name: "Paladio", unit: "USD/oz" },
];

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

async function fetchOne(sym: string): Promise<{ price: number; updatedAt: string } | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${sym}`, {
      headers: { "User-Agent": "geocapitals/1.0" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { price?: number; updatedAt?: string; error?: string };
    if (!j.price || j.error) return null;
    return { price: j.price, updatedAt: j.updatedAt ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

export const getMetalPrices = createServerFn({ method: "GET" }).handler(async (): Promise<{
  quotes: MetalQuote[];
  fetchedAt: string;
}> => {
  const results = await Promise.all(SYMBOLS.map((s) => fetchOne(s.sym).then((r) => ({ meta: s, r }))));
  const quotes: MetalQuote[] = results
    .filter((x) => x.r != null)
    .map(({ meta, r }) => ({
      code: meta.code,
      name: meta.name,
      unit: meta.unit,
      price: fmt(r!.price),
      updatedAt: r!.updatedAt,
    }));
  return { quotes, fetchedAt: new Date().toISOString() };
});
