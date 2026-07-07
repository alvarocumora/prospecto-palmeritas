import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  computePayableValue,
  normalizeDeleterious,
  type PayableResult,
  type PriceInputs,
} from "@/lib/payableValue";
import { parseMindicador } from "@/lib/metalPrices";

// Agente Assay-to-Value: valor pagable de un lote a precio de mercado en vivo,
// con comparación contra el precio pedido. Público, de solo lectura, sin
// persistencia. Cobre desde mindicador.cl (Banco Central); oro/plata desde
// gold-api. Degrada con elegancia si una fuente falla.

export type MarketComparison = {
  askingTotalUsd: number | null;
  estimatedTotalUsd: number | null;
  deltaPct: number | null; // (asking − estimado) / estimado
  verdict: "en_mercado" | "sobre_mercado" | "bajo_mercado" | "sin_datos";
};

export type PayableValuation = {
  lotId: string;
  commodity: string;
  result: PayableResult;
  market: MarketComparison;
  priceSources: { cobre: boolean; oro: boolean; plata: boolean };
  checkedAt: string;
};

const input = z.object({ lotId: z.string().uuid() });

async function fetchCuUsdT(): Promise<number | null> {
  try {
    const res = await fetch("https://mindicador.cl/api", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const prices = parseMindicador(await res.json());
    return prices ? prices.cobreUsdT : null;
  } catch {
    return null;
  }
}

async function fetchGoldApi(sym: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${sym}`, {
      headers: { "User-Agent": "geocapitals/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { price?: number; error?: string };
    return j.price && !j.error ? j.price : null;
  } catch {
    return null;
  }
}

/** Precios de mercado en vivo (cobre + oro + plata), reutilizable por otros agentes. */
export async function fetchLivePrices(): Promise<PriceInputs> {
  const [cuUsdT, auUsdOz, agUsdOz] = await Promise.all([
    fetchCuUsdT(),
    fetchGoldApi("XAU"),
    fetchGoldApi("XAG"),
  ]);
  return { cuUsdT, auUsdOz, agUsdOz };
}

function classify(asking: number | null, estimated: number | null): MarketComparison {
  if (asking == null || estimated == null || estimated <= 0)
    return {
      askingTotalUsd: asking,
      estimatedTotalUsd: estimated,
      deltaPct: null,
      verdict: "sin_datos",
    };
  const deltaPct = (asking - estimated) / estimated;
  let verdict: MarketComparison["verdict"] = "en_mercado";
  if (deltaPct > 0.1) verdict = "sobre_mercado";
  else if (deltaPct < -0.1) verdict = "bajo_mercado";
  return { askingTotalUsd: asking, estimatedTotalUsd: estimated, deltaPct, verdict };
}

export const estimatePayableValue = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<PayableValuation | null> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { data: lot } = await sb
      .from("commodity_lots")
      .select(
        "id, commodity, grade_pct, moisture_pct, tonnage_available_t, deleterious_json, asking_price_usd",
      )
      .eq("id", data.lotId)
      .maybeSingle();
    if (!lot) return null;

    const [cuUsdT, auUsdOz, agUsdOz] = await Promise.all([
      fetchCuUsdT(),
      fetchGoldApi("XAU"),
      fetchGoldApi("XAG"),
    ]);
    const prices: PriceInputs = { cuUsdT, auUsdOz, agUsdOz };

    const result = computePayableValue({
      commodity: lot.commodity as string,
      gradePct: lot.grade_pct != null ? Number(lot.grade_pct) : null,
      moisturePct: lot.moisture_pct != null ? Number(lot.moisture_pct) : null,
      tonnage: lot.tonnage_available_t != null ? Number(lot.tonnage_available_t) : null,
      deleterious: normalizeDeleterious(lot.deleterious_json),
      prices,
    });

    const asking = lot.asking_price_usd != null ? Number(lot.asking_price_usd) : null;
    const market = classify(asking, result.netTotalUsd);

    return {
      lotId: data.lotId,
      commodity: lot.commodity as string,
      result,
      market,
      priceSources: { cobre: cuUsdT != null, oro: auUsdOz != null, plata: agUsdOz != null },
      checkedAt: new Date().toISOString(),
    };
  });
