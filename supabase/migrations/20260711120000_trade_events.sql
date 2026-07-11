-- =========================================================
-- trade_events: feed de actividad y auditoría del trade.
-- Cada acción relevante (creación, cambio de etapa, documento cargado/firmado/
-- verificado, mensaje entre contrapartes) queda registrada y visible para ambas
-- partes. Es la capa de colaboración del Trade Desk.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  kind text NOT NULL,          -- created | stage_changed | doc_uploaded | doc_signed | doc_verified | message
  detail text,
  doc_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_events_trade ON public.trade_events(trade_id, created_at DESC);
ALTER TABLE public.trade_events ENABLE ROW LEVEL SECURITY;

-- Ambas contrapartes ven el feed del trade.
CREATE POLICY "Parties view trade events"
  ON public.trade_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_events.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

-- Cada parte registra sus propios eventos.
CREATE POLICY "Parties add trade events"
  ON public.trade_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.commodity_trades t
      WHERE t.id = trade_id
        AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
    )
  );
