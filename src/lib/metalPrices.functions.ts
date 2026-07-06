import { createServerFn } from "@tanstack/react-start";
import {
  buildMetalPrices,
  parseMindicador,
  LB_PER_TONNE,
  type MetalPrices,
} from "@/lib/metalPrices";
import { ECON_DEFAULTS } from "@/lib/mining-economics";

// Precio del cobre en vivo (Banco Central vía mindicador.cl) para el panel de
// productores/vendedores y el modelo ENAMI. Cachea en memoria del servidor por
// unos minutos para no golpear la fuente en cada request. Si la fuente falla,
// devuelve un fallback con el default económico marcado como stale.

const CACHE_TTL_MS = 10 * 60_000;
let cache: { at: number; data: MetalPrices } | null = null;

function fallbackPrices(): MetalPrices {
  // ECON_DEFAULTS.lme_cu_usd_t está en USD/t; se pasa a USD/lb para el builder.
  const usdLb = ECON_DEFAULTS.lme_cu_usd_t / LB_PER_TONNE;
  return buildMetalPrices(usdLb, null, null, {
    source: "Valor de referencia (fuente en vivo no disponible)",
    stale: true,
  });
}

export const getMetalPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<MetalPrices> => {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
    try {
      const res = await fetch("https://mindicador.cl/api", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`mindicador ${res.status}`);
      const json = await res.json();
      const prices = parseMindicador(json);
      if (!prices) throw new Error("cobre no disponible en la respuesta");
      cache = { at: Date.now(), data: prices };
      return prices;
    } catch {
      // No cachear el fallback: reintentar en el próximo request.
      return fallbackPrices();
    }
  },
);
