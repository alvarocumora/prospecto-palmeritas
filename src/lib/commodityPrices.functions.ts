import { createServerFn } from "@tanstack/react-start";

export type MetalQuote = {
  code: string;
  name: string;
  price: string;
  unit: string;
  chg: string;
  up: boolean;
};

// Stooq symbols — free CSV endpoint, no key required.
const SYMBOLS: Array<{ sym: string; code: string; name: string; unit: string; scale?: number }> = [
  { sym: "gc.f", code: "XAU", name: "Oro", unit: "USD/oz" },
  { sym: "si.f", code: "XAG", name: "Plata", unit: "USD/oz" },
  { sym: "hg.f", code: "HG", name: "Cobre", unit: "USD/lb" },
  { sym: "pl.f", code: "XPT", name: "Platino", unit: "USD/oz" },
  { sym: "pa.f", code: "XPD", name: "Paladio", unit: "USD/oz" },
  { sym: "ali.f", code: "AL", name: "Aluminio", unit: "USD/t" },
  { sym: "zi.f", code: "ZN", name: "Zinc", unit: "USD/t" },
  { sym: "ni.f", code: "NI", name: "Níquel", unit: "USD/t" },
  { sym: "tio.f", code: "FE", name: "Hierro 62%", unit: "USD/t" },
  { sym: "^dxy", code: "DXY", name: "Dollar Index", unit: "idx" },
];

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

async function fetchOne(sym: string): Promise<{ price: number; chgPct: number } | null> {
  try {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const csv = await res.text();
    const [header, row] = csv.trim().split("\n");
    if (!row || !header) return null;
    const cols = row.split(",");
    // Symbol,Date,Time,Open,High,Low,Close,Volume
    const open = parseFloat(cols[3]);
    const close = parseFloat(cols[6]);
    if (!isFinite(close) || close <= 0) return null;
    const chgPct = isFinite(open) && open > 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, chgPct };
  } catch {
    return null;
  }
}

export const getMetalPrices = createServerFn({ method: "GET" }).handler(async (): Promise<{
  quotes: MetalQuote[];
  updatedAt: string;
}> => {
  const results = await Promise.all(SYMBOLS.map((s) => fetchOne(s.sym).then((r) => ({ meta: s, r }))));
  const quotes: MetalQuote[] = results
    .filter((x) => x.r != null)
    .map(({ meta, r }) => ({
      code: meta.code,
      name: meta.name,
      unit: meta.unit,
      price: fmt(r!.price),
      chg: `${r!.chgPct >= 0 ? "+" : ""}${r!.chgPct.toFixed(2)}%`,
      up: r!.chgPct >= 0,
    }));
  return { quotes, updatedAt: new Date().toISOString() };
});
