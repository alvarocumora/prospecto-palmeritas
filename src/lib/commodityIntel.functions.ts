// Inteligencia de mercado para una commodity: último precio, histórico corto y
// comparables. Lee de commodity_prices y market_comparables. El símbolo se
// resuelve por nombre libre (case-insensitive) o por código conocido.
import { createServerFn } from "@tanstack/react-start";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type PricePoint = {
  price: number;
  unit: string;
  source: string | null;
  updated_at: string;
  change_pct: number;
};

export type Comparable = {
  id: string;
  project_name: string;
  country: string;
  region: string | null;
  commodity: string;
  stage: string;
  deal_type: string;
  deal_date: string | null;
  price_usd: number;
  resource_tonnes: number | null;
  resource_grade: number | null;
  resource_grade_unit: string | null;
  source: string;
};

export type IntelResult = {
  symbolQuery: string;
  matchedSymbol: string | null;
  latest: PricePoint | null;
  history: Array<{ price: number; updated_at: string }>;
  comparables: Comparable[];
};

// Alias humanos → símbolos que usa commodity_prices (mismo esquema que gold-api)
const ALIAS_TO_SYMBOL: Record<string, string> = {
  cobre: "HG",
  copper: "HG",
  cu: "HG",
  oro: "XAU",
  gold: "XAU",
  au: "XAU",
  plata: "XAG",
  silver: "XAG",
  ag: "XAG",
  platino: "XPT",
  platinum: "XPT",
  paladio: "XPD",
  palladium: "XPD",
  antimonio: "SB",
  antimony: "SB",
  sb: "SB",
  ree: "REE",
  "tierras raras": "REE",
  "rare earths": "REE",
  litio: "LI",
  lithium: "LI",
  zinc: "ZN",
  zn: "ZN",
  plomo: "PB",
  lead: "PB",
  niquel: "NI",
  nickel: "NI",
  estaño: "SN",
  tin: "SN",
  aluminio: "AL",
  aluminum: "AL",
};

function resolveSymbol(input: string): string {
  const k = input.trim().toLowerCase();
  return ALIAS_TO_SYMBOL[k] ?? input.trim().toUpperCase();
}

export const getCommodityIntel = createServerFn({ method: "GET" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) =>
    z
      .object({
        commodity: z.string().min(1),
        limitComps: z.number().int().min(1).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<IntelResult> => {
    const sb = asSb(context.supabase);
    const symbol = resolveSymbol(data.commodity);

    // Último precio + histórico corto (misma tabla; ordenamos por updated_at)
    const { data: rows } = await sb
      .from("commodity_prices")
      .select("price, unit, source, updated_at, change_pct")
      .eq("symbol", symbol)
      .order("updated_at", { ascending: false })
      .limit(30);
    const arr = (rows ?? []) as Array<{
      price: number;
      unit: string;
      source: string | null;
      updated_at: string;
      change_pct: number;
    }>;
    const latest = arr[0] ?? null;

    // Comparables filtrados por nombre de commodity (ILIKE tolerante)
    const { data: comps } = await sb
      .from("market_comparables")
      .select(
        "id, project_name, country, region, commodity, stage, deal_type, deal_date, price_usd, resource_tonnes, resource_grade, resource_grade_unit, source",
      )
      .ilike("commodity", `%${data.commodity}%`)
      .order("deal_date", { ascending: false, nullsFirst: false })
      .limit(data.limitComps ?? 12);

    return {
      symbolQuery: data.commodity,
      matchedSymbol: latest ? symbol : null,
      latest,
      history: arr.map((r) => ({ price: r.price, updated_at: r.updated_at })).reverse(),
      comparables: (comps ?? []) as Comparable[],
    };
  });

// Ingesta manual: upsert de un precio de referencia. Solo para autenticados
// (no admin) — cada usuario puede empujar sus lecturas de mercado; en la UI se
// muestra la fuente. RLS de commodity_prices ya limita quién escribe.
export const upsertCommodityPrice = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) =>
    z
      .object({
        symbol: z.string().min(1),
        name: z.string().min(1),
        price: z.number().positive(),
        unit: z.string().min(1),
        source: z.string().nullable().optional(),
        change_pct: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sb = asSb(context.supabase);
    const { error } = await sb.from("commodity_prices").insert({
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      price: data.price,
      unit: data.unit,
      source: data.source ?? "manual",
      change_pct: data.change_pct ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
