-- =========================================================
-- Mesa de trading de commodities: transacción + ecosistema documental.
--
-- Modela una operación de compraventa internacional (concentrado, cátodos, etc.)
-- con su pipeline (ICPO → FCO → SPA → pago SBLC/DLC → embarque → entrega) y el
-- conjunto de documentos de comercio exterior y trade finance. Es gestión
-- documental y de estado; NO emite instrumentos financieros.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.commodity_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text,                       -- folio interno del trade
  lot_id uuid REFERENCES public.commodity_lots(id) ON DELETE SET NULL,
  inquiry_id uuid REFERENCES public.commodity_inquiries(id) ON DELETE SET NULL,
  buyer_user_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  commodity text,
  form text,                            -- concentrate | cathode | ...
  quantity_t numeric,
  incoterm text,
  unit_price_usd numeric,
  total_value_usd numeric,
  currency text NOT NULL DEFAULT 'USD',
  payment_instrument text,              -- sblc_mt760 | dlc | tt | escrow
  stage text NOT NULL DEFAULT 'icpo',   -- icpo|fco|spa|payment|shipping|delivered|closed|cancelled
  status text NOT NULL DEFAULT 'active',-- active | closed | cancelled
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_buyer ON public.commodity_trades(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_seller ON public.commodity_trades(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_lot ON public.commodity_trades(lot_id);
ALTER TABLE public.commodity_trades ENABLE ROW LEVEL SECURITY;

-- Solo las contrapartes del trade lo ven y editan.
CREATE POLICY "Parties view trade"
  ON public.commodity_trades FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());

CREATE POLICY "Party creates trade"
  ON public.commodity_trades FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid())
  );

CREATE POLICY "Parties update trade"
  ON public.commodity_trades FOR UPDATE TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());

CREATE TRIGGER trg_commodity_trades_updated
  BEFORE UPDATE ON public.commodity_trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- trade_documents: ecosistema documental del trade
-- =========================================================
CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  doc_type text NOT NULL,               -- clave del catálogo (icpo, sgs_certificate, ...)
  phase text,                           -- comercial | financiero | exportacion
  status text NOT NULL DEFAULT 'pending', -- pending|uploaded|signed|verified|rejected
  file_url text,
  issuer text,                          -- emisor (ej. SGS, banco, aduana)
  reference text,                       -- número/folio del documento
  signed_by uuid,
  signed_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_documents_trade ON public.trade_documents(trade_id);
ALTER TABLE public.trade_documents ENABLE ROW LEVEL SECURITY;

-- Acceso vía pertenencia al trade (comprador o vendedor).
CREATE POLICY "Parties view trade docs"
  ON public.trade_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_documents.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE POLICY "Parties add trade docs"
  ON public.trade_documents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.commodity_trades t
      WHERE t.id = trade_id
        AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
    )
  );

CREATE POLICY "Parties update trade docs"
  ON public.trade_documents FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_documents.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE POLICY "Parties delete trade docs"
  ON public.trade_documents FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_documents.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE TRIGGER trg_trade_documents_updated
  BEFORE UPDATE ON public.trade_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
