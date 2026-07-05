import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetalPrices } from "@/lib/commodityPrices.functions";

export type Currency = "USD" | "CLP";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** CLP por 1 USD. null si aún no hay dato. */
  usdClp: number | null;
  /** Convierte un monto en USD a la moneda activa. */
  convert: (usd: number | null | undefined) => number | null;
  /** Formatea un monto en USD directamente en la moneda activa. */
  format: (usd: number | null | undefined, opts?: { unit?: string; compact?: boolean }) => string;
  symbol: string;
};

const CurrencyContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "geocapitals.currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  // Hidratar desde localStorage tras montar (evita mismatch de SSR).
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === "USD" || v === "CLP") setCurrencyState(v);
    } catch {
      /* noop */
    }
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* noop */
    }
  };

  const fetchPrices = useServerFn(getMetalPrices);
  const { data } = useQuery({
    queryKey: ["fx", "usd-clp"],
    queryFn: () => fetchPrices(),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const usdClp = data?.fx?.usdClp ?? null;

  const value = useMemo<Ctx>(() => {
    const convert = (usd: number | null | undefined): number | null => {
      if (usd == null || Number.isNaN(usd)) return null;
      if (currency === "USD") return usd;
      if (usdClp == null) return null;
      return usd * usdClp;
    };
    const format = (
      usd: number | null | undefined,
      opts?: { unit?: string; compact?: boolean },
    ): string => {
      const v = convert(usd);
      if (v == null) return "—";
      const compact = opts?.compact;
      const abs = Math.abs(v);
      const num = compact
        ? abs >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M`
          : abs >= 1_000
            ? `${(v / 1_000).toFixed(0)}k`
            : v.toFixed(abs >= 10 ? 0 : 2)
        : v.toLocaleString(currency === "CLP" ? "es-CL" : "en-US", {
            maximumFractionDigits: currency === "CLP" ? 0 : abs >= 1000 ? 0 : abs >= 10 ? 2 : 3,
          });
      const symbol = currency === "CLP" ? "CLP$" : "US$";
      const unit = opts?.unit ? ` ${opts.unit}` : "";
      return `${symbol} ${num}${unit}`;
    };
    return {
      currency,
      setCurrency,
      usdClp,
      convert,
      format,
      symbol: currency === "CLP" ? "CLP$" : "US$",
    };
  }, [currency, usdClp]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
