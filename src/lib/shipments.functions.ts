import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAdvanceShipment, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/shipments";

// Embarques de trades: CRUD con RLS de contrapartes y trazabilidad — cada
// cambio de estado se registra en trade_events (auditoría de la operación).

const asSb = (c: unknown): SupabaseClient => c as SupabaseClient;

async function logTradeEvent(
  sb: SupabaseClient,
  tradeId: string,
  userId: string,
  kind: string,
  detail: string,
) {
  await sb.from("trade_events").insert({
    trade_id: tradeId,
    actor_user_id: userId,
    kind,
    detail,
  });
}

export type ShipmentRow = {
  id: string;
  trade_id: string;
  reference: string | null;
  vessel_name: string | null;
  bl_number: string | null;
  carrier: string | null;
  container_count: number | null;
  quantity_t: number | null;
  port_loading: string | null;
  port_discharge: string | null;
  etd: string | null;
  eta: string | null;
  status: ShipmentStatus;
  tracking_url: string | null;
  notes: string | null;
  created_at: string;
  trade?: { reference: string | null; commodity: string | null } | null;
};

// ---------- Listar mis embarques (RLS filtra por contraparte) ----------
export const listMyShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShipmentRow[]> => {
    const { data } = await asSb(context.supabase)
      .from("trade_shipments")
      .select("*, trade:commodity_trades(reference, commodity)")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as ShipmentRow[];
  });

// ---------- Crear embarque sobre un trade ----------
const CreateInput = z.object({
  tradeId: z.string().uuid(),
  vesselName: z.string().trim().max(120).optional(),
  blNumber: z.string().trim().max(80).optional(),
  carrier: z.string().trim().max(120).optional(),
  quantityT: z.number().positive().optional(),
  containerCount: z.number().int().positive().optional(),
  portLoading: z.string().trim().max(120).optional(),
  portDischarge: z.string().trim().max(120).optional(),
  etd: z.string().trim().max(10).optional(),
  eta: z.string().trim().max(10).optional(),
  trackingUrl: z.string().trim().url().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: row, error } = await sb
      .from("trade_shipments")
      .insert({
        trade_id: data.tradeId,
        created_by: context.userId as string,
        reference: `SHP-${Date.now().toString(36).toUpperCase()}`,
        vessel_name: data.vesselName ?? null,
        bl_number: data.blNumber ?? null,
        carrier: data.carrier ?? null,
        quantity_t: data.quantityT ?? null,
        container_count: data.containerCount ?? null,
        port_loading: data.portLoading ?? null,
        port_discharge: data.portDischarge ?? null,
        etd: data.etd || null,
        eta: data.eta || null,
        tracking_url: data.trackingUrl ?? null,
        notes: data.notes ?? null,
      })
      .select("id, reference")
      .single();
    if (error) throw new Error(error.message);
    await logTradeEvent(
      sb,
      data.tradeId,
      context.userId as string,
      "shipment_created",
      `Embarque ${(row as { reference: string }).reference} creado${data.vesselName ? ` · nave ${data.vesselName}` : ""}${data.blNumber ? ` · BL ${data.blNumber}` : ""}`,
    );
    return { id: (row as { id: string }).id };
  });

// ---------- Avanzar estado (con trazabilidad) ----------
const AdvanceInput = z.object({
  id: z.string().uuid(),
  next: z.enum(["at_port", "on_water", "arrived", "delivered"]),
});

export const advanceShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AdvanceInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: ship } = await sb
      .from("trade_shipments")
      .select("trade_id, status, reference")
      .eq("id", data.id)
      .maybeSingle();
    if (!ship) throw new Error("Embarque no encontrado.");
    const current = (ship as { status: ShipmentStatus }).status;
    if (!canAdvanceShipment(current, data.next)) {
      throw new Error(
        `Transición inválida: ${SHIPMENT_STATUS_LABELS[current]} → ${SHIPMENT_STATUS_LABELS[data.next]}.`,
      );
    }
    const { error } = await sb
      .from("trade_shipments")
      .update({ status: data.next })
      .eq("id", data.id)
      .eq("status", current);
    if (error) throw new Error(error.message);
    await logTradeEvent(
      sb,
      (ship as { trade_id: string }).trade_id,
      context.userId as string,
      "shipment_status",
      `Embarque ${(ship as { reference: string | null }).reference ?? data.id.slice(0, 8)}: ${SHIPMENT_STATUS_LABELS[current]} → ${SHIPMENT_STATUS_LABELS[data.next]}`,
    );
    return { ok: true };
  });

// ---------- Trades elegibles para crear embarque ----------
export const listShippableTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await asSb(context.supabase)
      .from("commodity_trades")
      .select("id, reference, commodity, quantity_t, stage")
      .in("stage", ["spa", "payment", "shipping", "delivered"])
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Array<{
      id: string;
      reference: string | null;
      commodity: string | null;
      quantity_t: number | null;
      stage: string;
    }>;
  });
