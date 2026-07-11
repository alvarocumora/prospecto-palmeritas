import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { buildPriceIndex, type PricePoint, type CommodityIndexEntry } from "@/lib/priceIndex";
import { parseMindicador } from "@/lib/metalPrices";

// Índice de Precios Geocapitals: benchmark propietario por commodity a partir de
// las transacciones reales (commodity_trades) y la demanda (commodity_inquiries)
// del marketplace, anclado al cobre BML. Lectura pública (dato de referencia).

export type PriceIndexResult = {
  entries: CommodityIndexEntry[];
  cuAnchorUsdT: number | null; // cobre BML (USD/t) como referencia
  generatedAt: string;
  totalSamples: number;
};

const MAX_ROWS = 5000;

async function cuAnchorUsdT(): Promise<number | null> {
  try {
    const res = await fetch("https://mindicador.cl/api", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const prices = parseMindicador(await res.json());
    return prices ? prices.cobreUsdT : null;
  } catch {
    return null;
  }
}

export const getPriceIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<PriceIndexResult> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const empty: PriceIndexResult = {
      entries: [],
      cuAnchorUsdT: null,
      generatedAt: new Date().toISOString(),
      totalSamples: 0,
    };
    if (!url || !key) return empty;
    // Cliente sin tipar: commodity_trades es nueva (no está en types.ts).
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const points: PricePoint[] = [];

    // Transacciones: precio unitario efectivo (USD/t).
    const { data: trades } = await sb
      .from("commodity_trades")
      .select("commodity, unit_price_usd, status")
      .not("unit_price_usd", "is", null)
      .not("commodity", "is", null)
      .neq("status", "cancelled")
      .limit(MAX_ROWS);
    for (const t of trades ?? []) {
      const price = Number(t.unit_price_usd);
      if (!Number.isFinite(price) || price <= 0) continue;
      points.push({
        commodity: String(t.commodity),
        usdPerT: price,
        kind: t.status === "closed" ? "trade_closed" : "trade_active",
      });
    }

    // Demanda: precio objetivo del comprador (USD/t), commodity vía el lote.
    const { data: inquiries } = await sb
      .from("commodity_inquiries")
      .select("target_price_usd_t, lot_id")
      .not("target_price_usd_t", "is", null)
      .not("lot_id", "is", null)
      .limit(MAX_ROWS);
    const lotIds = Array.from(
      new Set((inquiries ?? []).map((i) => i.lot_id as string).filter(Boolean)),
    );
    const lotCommodity = new Map<string, string>();
    if (lotIds.length) {
      const { data: lots } = await sb
        .from("commodity_lots")
        .select("id, commodity")
        .in("id", lotIds);
      for (const l of lots ?? []) lotCommodity.set(l.id as string, String(l.commodity));
    }
    for (const iq of inquiries ?? []) {
      const price = Number(iq.target_price_usd_t);
      const commodity = lotCommodity.get(iq.lot_id as string);
      if (!commodity || !Number.isFinite(price) || price <= 0) continue;
      points.push({ commodity, usdPerT: price, kind: "inquiry" });
    }

    const entries = buildPriceIndex(points);
    return {
      entries,
      cuAnchorUsdT: await cuAnchorUsdT(),
      generatedAt: new Date().toISOString(),
      totalSamples: points.length,
    };
  },
);
