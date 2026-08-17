import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTradeRole } from "@/lib/access/roleMiddleware";
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

// Notifica por email a la contraparte del trade (el que NO ejecutó la acción).
// Nunca puede romper la mutación principal: todo va en try/catch.
async function notifyCounterparty(
  sb: SupabaseClient,
  tradeId: string,
  actorUserId: string,
  idempotencyKey: string,
  templateData: Record<string, unknown>,
) {
  try {
    const { data: trade } = await sb
      .from("commodity_trades")
      .select("buyer_user_id, seller_user_id, reference, commodity")
      .eq("id", tradeId)
      .maybeSingle();
    if (!trade) return;
    const t = trade as {
      buyer_user_id: string;
      seller_user_id: string;
      reference: string | null;
      commodity: string | null;
    };
    const counterpartyId = t.buyer_user_id === actorUserId ? t.seller_user_id : t.buyer_user_id;
    if (!counterpartyId || counterpartyId === actorUserId) return;
    // profiles no expone email entre usuarios (RLS endurecido): lectura admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", counterpartyId)
      .maybeSingle();
    if (!prof?.email) return;
    const { sendInternalEmail } = await import("@/lib/email/send-internal.server");
    await sendInternalEmail({
      templateName: "shipment-update",
      recipientEmail: prof.email,
      idempotencyKey,
      templateData: {
        tradeRef: t.reference ?? tradeId.slice(0, 8),
        commodity: t.commodity ?? undefined,
        trackingPath: `/dashboard/trades/${tradeId}`,
        ...templateData,
      },
    });
  } catch (e) {
    console.error("[shipments] notify counterparty failed", e);
  }
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
  .middleware([requireTradeRole])
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
  .middleware([requireTradeRole])
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
    await notifyCounterparty(
      sb,
      data.tradeId,
      context.userId as string,
      `shipment-created:${(row as { id: string }).id}`,
      {
        kind: "created",
        shipmentRef: (row as { reference: string }).reference,
        vesselName: data.vesselName ?? undefined,
        statusLabel: SHIPMENT_STATUS_LABELS.preparing,
        route:
          data.portLoading || data.portDischarge
            ? `${data.portLoading ?? "—"} → ${data.portDischarge ?? "—"}`
            : undefined,
        eta: data.eta || undefined,
      },
    );
    return { id: (row as { id: string }).id };
  });

// ---------- Avanzar estado (con trazabilidad) ----------
const AdvanceInput = z.object({
  id: z.string().uuid(),
  next: z.enum(["at_port", "on_water", "arrived", "delivered"]),
});

export const advanceShipment = createServerFn({ method: "POST" })
  .middleware([requireTradeRole])
  .inputValidator((d: unknown) => AdvanceInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = asSb(context.supabase);
    const { data: ship } = await sb
      .from("trade_shipments")
      .select("trade_id, status, reference, vessel_name, port_loading, port_discharge, eta")
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
    const s = ship as {
      trade_id: string;
      reference: string | null;
      vessel_name: string | null;
      port_loading: string | null;
      port_discharge: string | null;
      eta: string | null;
    };
    await notifyCounterparty(
      sb,
      s.trade_id,
      context.userId as string,
      `shipment-status:${data.id}:${data.next}`,
      {
        kind: "status",
        shipmentRef: s.reference ?? data.id.slice(0, 8),
        vesselName: s.vessel_name ?? undefined,
        statusLabel: SHIPMENT_STATUS_LABELS[data.next],
        route:
          s.port_loading || s.port_discharge
            ? `${s.port_loading ?? "—"} → ${s.port_discharge ?? "—"}`
            : undefined,
        eta: s.eta
          ? new Date(s.eta).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : undefined,
      },
    );
    return { ok: true };
  });

// ---------- Trades elegibles para crear embarque ----------
export const listShippableTrades = createServerFn({ method: "GET" })
  .middleware([requireTradeRole])
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
