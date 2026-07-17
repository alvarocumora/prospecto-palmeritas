import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isShipmentDelayed, type ShipmentStatus } from "@/lib/shipments";
import type { RawTradeEvent } from "@/lib/tradeTimeline";

// Resumen de NEGOCIO del usuario (cross-proyecto): trades, envíos, firmas,
// cotizaciones, lotes y listings — el corazón del nuevo INICIO. Todo con RLS
// del usuario salvo las cotizaciones recibidas (patrón admin ya existente).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type BusinessTradeRow = {
  id: string;
  reference: string | null;
  commodity: string | null;
  quantity_t: number | null;
  total_value_usd: number | null;
  stage: string;
  status: string;
  role: "buyer" | "seller";
  created_at: string;
};

export type BusinessShipmentRow = {
  id: string;
  trade_id: string;
  reference: string | null;
  vessel_name: string | null;
  eta: string | null;
  status: ShipmentStatus;
  delayed: boolean;
};

export type BusinessSignRow = {
  id: string;
  title: string;
  status: string;
  signer_name_expected: string | null;
  signed_by_name: string | null;
  created_at: string;
};

export type BusinessOverview = {
  trades: {
    active: number;
    closed: number;
    pipelineUsd: number;
    recent: BusinessTradeRow[];
  };
  shipments: {
    active: number;
    delayed: number;
    recent: BusinessShipmentRow[];
  };
  signs: {
    pending: number;
    signed: number;
    recent: BusinessSignRow[];
  };
  inquiries: {
    received: number;
    sent: number;
  };
  lots: number;
  listings: number;
  /** Contrapartes únicas en mis trades (clientes/proveedores). */
  clients: number;
  sourcing: {
    openRequests: number;
    totalProposals: number;
  };
  events: RawTradeEvent[];
};

export const getBusinessOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessOverview> => {
    const sb = asSb(context.supabase);
    const me = context.userId as string;

    const [tradesQ, shipsQ, signsQ, lotsQ, listingsQ, sentInqQ, eventsQ] = await Promise.all([
      sb
        .from("commodity_trades")
        .select(
          "id, reference, commodity, quantity_t, total_value_usd, stage, status, buyer_user_id, seller_user_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("trade_shipments")
        .select("id, trade_id, reference, vessel_name, eta, status, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("document_sign_requests")
        .select("id, title, status, signer_name_expected, signed_by_name, created_at")
        .eq("created_by", me)
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("commodity_lots")
        .select("id", { count: "exact" })
        .eq("seller_user_id", me)
        .limit(100),
      sb
        .from("property_listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", me),
      sb
        .from("commodity_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("buyer_user_id", me),
      sb
        .from("trade_events")
        .select("id, kind, detail, doc_type, created_at")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    // Cotizaciones recibidas sobre MIS lotes (patrón admin existente del
    // marketplace: las inquiries de compradores no son visibles por RLS).
    let received = 0;
    try {
      const lotIds = ((lotsQ.data ?? []) as Array<{ id: string }>).map((l) => l.id);
      if (lotIds.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("commodity_inquiries")
          .select("id", { count: "exact", head: true })
          .in("lot_id", lotIds);
        received = count ?? 0;
      }
    } catch (e) {
      console.error("[businessOverview] received inquiries failed", e);
    }

    type TradeRaw = BusinessTradeRow & { buyer_user_id: string; seller_user_id: string };
    const trades = (tradesQ.data ?? []) as TradeRaw[];
    const activeTrades = trades.filter((t) => t.status !== "cancelled" && t.stage !== "closed");
    const counterparties = new Set<string>();
    for (const t of trades) {
      const other = t.buyer_user_id === me ? t.seller_user_id : t.buyer_user_id;
      if (other && other !== me) counterparties.add(other);
    }

    // Sourcing (best-effort: la tabla puede no estar migrada aún).
    let openRequests = 0;
    let totalProposals = 0;
    try {
      const { data: reqs } = await sb
        .from("sourcing_requests")
        .select("status, submissions:sourcing_submissions(id)")
        .limit(200);
      for (const r of (reqs ?? []) as Array<{
        status: string;
        submissions?: Array<{ id: string }> | null;
      }>) {
        if (r.status === "abierto") openRequests += 1;
        totalProposals += r.submissions?.length ?? 0;
      }
    } catch {
      /* tabla de sourcing aún no aplicada */
    }

    const now = new Date();
    const ships = (shipsQ.data ?? []) as Array<
      Omit<BusinessShipmentRow, "delayed"> & { created_at: string }
    >;
    const activeShips = ships.filter((s) => s.status !== "delivered");

    const signs = (signsQ.data ?? []) as BusinessSignRow[];

    return {
      trades: {
        active: activeTrades.length,
        closed: trades.filter((t) => t.stage === "closed").length,
        pipelineUsd: activeTrades.reduce((a, t) => a + (t.total_value_usd ?? 0), 0),
        recent: activeTrades.slice(0, 6).map((t) => ({
          id: t.id,
          reference: t.reference,
          commodity: t.commodity,
          quantity_t: t.quantity_t,
          total_value_usd: t.total_value_usd,
          stage: t.stage,
          status: t.status,
          role: t.buyer_user_id === me ? "buyer" : "seller",
          created_at: t.created_at,
        })),
      },
      shipments: {
        active: activeShips.length,
        delayed: activeShips.filter((s) => isShipmentDelayed(s.status, s.eta, now)).length,
        recent: activeShips.slice(0, 5).map((s) => ({
          id: s.id,
          trade_id: s.trade_id,
          reference: s.reference,
          vessel_name: s.vessel_name,
          eta: s.eta,
          status: s.status,
          delayed: isShipmentDelayed(s.status, s.eta, now),
        })),
      },
      signs: {
        pending: signs.filter((s) => s.status === "pending").length,
        signed: signs.filter((s) => s.status === "signed").length,
        recent: signs.slice(0, 5),
      },
      inquiries: {
        received,
        sent: sentInqQ.count ?? 0,
      },
      lots: lotsQ.count ?? 0,
      listings: listingsQ.count ?? 0,
      clients: counterparties.size,
      sourcing: { openRequests, totalProposals },
      events: (eventsQ.data ?? []) as RawTradeEvent[],
    };
  });
