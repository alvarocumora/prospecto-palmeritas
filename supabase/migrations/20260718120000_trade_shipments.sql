-- =========================================================
-- trade_shipments: tracking logístico real de los trades de
-- commodities (nave, BL, puertos, ETD/ETA, estado del envío).
-- La etapa "shipping" del pipeline deja de ser una etiqueta:
-- cada trade puede tener uno o más embarques trazables, y los
-- cambios de estado se registran en trade_events (auditoría).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.trade_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  reference text,                       -- folio interno del embarque
  vessel_name text,
  bl_number text,                       -- bill of lading
  carrier text,                         -- naviera / forwarder
  container_count integer,
  quantity_t numeric,                   -- toneladas embarcadas
  port_loading text,
  port_discharge text,
  etd date,                             -- zarpe estimado/real
  eta date,                             -- arribo estimado
  status text NOT NULL DEFAULT 'preparing', -- preparing|at_port|on_water|arrived|delivered
  tracking_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_shipments_trade ON public.trade_shipments(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_shipments_status ON public.trade_shipments(status, eta);

ALTER TABLE public.trade_shipments ENABLE ROW LEVEL SECURITY;

-- Solo las contrapartes del trade ven/gestionan sus embarques (mismo criterio
-- que trade_documents).
CREATE POLICY "Parties view shipments"
  ON public.trade_shipments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE POLICY "Party creates shipment"
  ON public.trade_shipments FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.commodity_trades t
      WHERE t.id = trade_id
        AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
    )
  );

CREATE POLICY "Parties update shipment"
  ON public.trade_shipments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE TRIGGER trg_trade_shipments_updated
  BEFORE UPDATE ON public.trade_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
