import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
import type { ShipmentStatus } from "@/lib/shipments";
import type { RawTradeEvent } from "@/lib/tradeTimeline";

// Payload de la vista de trazabilidad unificada de un trade. RLS garantiza que
// solo las contrapartes lo obtienen (trade, eventos y embarques filtran solos).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

export type TradeTracking = {
  trade: {
    id: string;
    reference: string | null;
    commodity: string | null;
    quantity_t: number | null;
    incoterm: string | null;
    unit_price_usd: number | null;
    total_value_usd: number | null;
    stage: string;
    status: string;
    created_at: string;
  };
  shipments: Array<{
    id: string;
    reference: string | null;
    vessel_name: string | null;
    bl_number: string | null;
    port_loading: string | null;
    port_discharge: string | null;
    eta: string | null;
    status: ShipmentStatus;
    tracking_url: string | null;
  }>;
  events: RawTradeEvent[];
  docsCount: number;
};

export const getTradeTracking = createServerFn({ method: "GET" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) => z.object({ tradeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TradeTracking | null> => {
    const sb = asSb(context.supabase);

    const { data: trade } = await sb
      .from("commodity_trades")
      .select(
        "id, reference, commodity, quantity_t, incoterm, unit_price_usd, total_value_usd, stage, status, created_at",
      )
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade) return null;

    const [shipments, events, docs] = await Promise.all([
      sb
        .from("trade_shipments")
        .select(
          "id, reference, vessel_name, bl_number, port_loading, port_discharge, eta, status, tracking_url",
        )
        .eq("trade_id", data.tradeId)
        .order("created_at", { ascending: false }),
      sb
        .from("trade_events")
        .select("id, kind, detail, doc_type, created_at")
        .eq("trade_id", data.tradeId)
        .order("created_at", { ascending: true })
        .limit(300),
      sb
        .from("trade_documents")
        .select("id", { count: "exact", head: true })
        .eq("trade_id", data.tradeId),
    ]);

    return {
      trade: trade as TradeTracking["trade"],
      shipments: (shipments.data ?? []) as TradeTracking["shipments"],
      events: (events.data ?? []) as RawTradeEvent[],
      docsCount: docs.count ?? 0,
    };
  });
