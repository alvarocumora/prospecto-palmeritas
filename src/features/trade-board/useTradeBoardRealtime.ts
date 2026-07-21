// Suscripción realtime al tablero: invalida la query `my-trades` cuando cambian
// los trades del usuario o sus documentos. RLS aplica en el servidor; el canal
// solo recibe rows autorizados.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useTradeBoardRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["my-trades"] });
    };
    const channel = supabase
      .channel("trade-board-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commodity_trades" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_documents" },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
