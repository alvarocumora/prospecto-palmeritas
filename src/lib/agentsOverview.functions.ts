import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatherLotSignals, type LotSignalsInput } from "@/lib/lotVerification.functions";
import { scoreLotVerification } from "@/lib/lotVerification";
import { computePayableValue, normalizeDeleterious } from "@/lib/payableValue";
import { fetchLivePrices } from "@/lib/payableValue.functions";
import {
  lotHealth,
  classifyMarket,
  type LotHealth,
  type MarketVerdict,
} from "@/lib/agentsOverview";

// Panel de agentes del vendedor: corre los agentes de confianza (Know-Your-Mine)
// y valor (Assay-to-Value) sobre cada lote del vendedor, con métricas de demanda.

const MAX_LOTS = 24;

export type LotAgentsRow = {
  lotId: string;
  title: string;
  commodity: string;
  status: string;
  isVerified: boolean;
  views: number;
  inquiries: number;
  trust: { score: number; level: "high" | "medium" | "low"; redFlags: number };
  valuation: { supported: boolean; netUsdDmt: number | null };
  market: { verdict: MarketVerdict; deltaPct: number | null };
  health: LotHealth;
  headline: string;
};

export type AgentsOverview = {
  lots: LotAgentsRow[];
  summary: { total: number; healthy: number; attention: number; risk: number };
};

export const getSellerAgentsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentsOverview> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { lots: [], summary: { total: 0, healthy: 0, attention: 0, risk: 0 } };
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const { data: lots } = await sb
      .from("commodity_lots")
      .select(
        "id, title, commodity, status, is_verified, views_count, inquiry_count, grade_pct, moisture_pct, tonnage_available_t, deleterious_json, asking_price_usd, project_id, organization_id, assay_report_url, certifications_json, origin_geojson",
      )
      .eq("seller_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_LOTS);
    if (!lots?.length)
      return { lots: [], summary: { total: 0, healthy: 0, attention: 0, risk: 0 } };

    const prices = await fetchLivePrices();

    const rows = await Promise.all(
      lots.map(async (lot): Promise<LotAgentsRow> => {
        const { signals } = await gatherLotSignals(sb, lot as unknown as LotSignalsInput);
        const trust = scoreLotVerification(signals);

        const valuation = computePayableValue({
          commodity: lot.commodity as string,
          gradePct: lot.grade_pct != null ? Number(lot.grade_pct) : null,
          moisturePct: lot.moisture_pct != null ? Number(lot.moisture_pct) : null,
          tonnage: lot.tonnage_available_t != null ? Number(lot.tonnage_available_t) : null,
          deleterious: normalizeDeleterious(lot.deleterious_json),
          prices,
        });

        const asking = lot.asking_price_usd != null ? Number(lot.asking_price_usd) : null;
        const market = classifyMarket(asking, valuation.supported ? valuation.netTotalUsd : null);
        const { health, headline } = lotHealth({
          trustLevel: trust.level,
          redFlagCount: trust.redFlags.length,
          valuationSupported: valuation.supported,
          marketVerdict: market.verdict,
        });

        return {
          lotId: lot.id as string,
          title: lot.title as string,
          commodity: lot.commodity as string,
          status: lot.status as string,
          isVerified: !!lot.is_verified,
          views: (lot.views_count as number) ?? 0,
          inquiries: (lot.inquiry_count as number) ?? 0,
          trust: { score: trust.score, level: trust.level, redFlags: trust.redFlags.length },
          valuation: {
            supported: valuation.supported,
            netUsdDmt: valuation.supported ? valuation.netUsdDmt : null,
          },
          market,
          health,
          headline,
        };
      }),
    );

    const summary = {
      total: rows.length,
      healthy: rows.filter((r) => r.health === "healthy").length,
      attention: rows.filter((r) => r.health === "attention").length,
      risk: rows.filter((r) => r.health === "risk").length,
    };
    return { lots: rows, summary };
  });
