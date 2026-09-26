// Suscripciones realtime para el módulo de trades:
// - `useTradeBoardRealtime`: invalida la lista `my-trades` y el detalle del
//   trade afectado cuando cambian filas en `commodity_trades` o
//   `trade_documents`.
// - `useTradeDetailRealtime(id)`: filtra los eventos por ese `id` /
//   `trade_id` para actualizar en vivo el panel expandido sin depender del
//   canal global.
// RLS aplica en el servidor; el canal solo recibe rows autorizados.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Row = Record<string, unknown> | null;

function tradeIdFromPayload(payload: { table: string; new: Row; old: Row }): string | null {
  const row = (payload.new ?? payload.old) as Row;
  if (!row) return null;
  if (payload.table === "commodity_trades") {
    const id = row["id"];
    return typeof id === "string" ? id : null;
  }
  if (payload.table === "trade_documents") {
    const id = row["trade_id"];
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function useTradeBoardRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const handle = (payload: { table: string; new: Row; old: Row }) => {
      qc.invalidateQueries({ queryKey: ["my-trades"] });
      const tradeId = tradeIdFromPayload(payload);
      if (tradeId) {
        qc.invalidateQueries({ queryKey: ["trade", tradeId] });
      }
    };
    const channel = supabase
      .channel("trade-board-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "commodity_trades" }, handle)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_documents" }, handle)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useTradeDetailRealtime(id: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["trade", id] });
      qc.invalidateQueries({ queryKey: ["my-trades"] });
    };
    const channel = supabase
      .channel(`trade-detail-live:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "commodity_trades",
          filter: `id=eq.${id}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_documents",
          filter: `trade_id=eq.${id}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, id]);
}
