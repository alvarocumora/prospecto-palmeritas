
-- ============ asset_offerings + offering_subscriptions ============
CREATE TABLE IF NOT EXISTS public.asset_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  token_symbol text NOT NULL,
  title text NOT NULL,
  description text,
  instrument text NOT NULL DEFAULT 'participation',
  total_units integer NOT NULL CHECK (total_units > 0),
  price_per_unit_usd numeric NOT NULL CHECK (price_per_unit_usd >= 0),
  currency text NOT NULL DEFAULT 'USD',
  min_units integer NOT NULL DEFAULT 1 CHECK (min_units > 0),
  status text NOT NULL DEFAULT 'draft',
  terms_url text,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_offerings_project ON public.asset_offerings(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_offerings_status ON public.asset_offerings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_offerings TO authenticated;
GRANT ALL ON public.asset_offerings TO service_role;
ALTER TABLE public.asset_offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View open offerings or own project" ON public.asset_offerings FOR SELECT TO authenticated
  USING (status <> 'draft' OR is_project_member(project_id, auth.uid()));
CREATE POLICY "Owners create offerings" ON public.asset_offerings FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]) AND auth.uid() = created_by);
CREATE POLICY "Owners update offerings" ON public.asset_offerings FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));
CREATE POLICY "Owners delete offerings" ON public.asset_offerings FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));
CREATE TRIGGER trg_asset_offerings_updated BEFORE UPDATE ON public.asset_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.offering_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.asset_offerings(id) ON DELETE CASCADE,
  investor_user_id uuid NOT NULL,
  units integer NOT NULL CHECK (units > 0),
  amount_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offering_subs_offering ON public.offering_subscriptions(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_subs_investor ON public.offering_subscriptions(investor_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offering_subscriptions TO authenticated;
GRANT ALL ON public.offering_subscriptions TO service_role;
ALTER TABLE public.offering_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own subs or as offering owner" ON public.offering_subscriptions FOR SELECT TO authenticated
  USING (investor_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.asset_offerings o WHERE o.id = offering_subscriptions.offering_id
      AND has_project_role(o.project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[])));
CREATE POLICY "Investor creates own subscription" ON public.offering_subscriptions FOR INSERT TO authenticated
  WITH CHECK (investor_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.asset_offerings o WHERE o.id = offering_id AND o.status = 'open'));
CREATE POLICY "Investor or owner updates subscription" ON public.offering_subscriptions FOR UPDATE TO authenticated
  USING (investor_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.asset_offerings o WHERE o.id = offering_subscriptions.offering_id
      AND has_project_role(o.project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[])));
CREATE TRIGGER trg_offering_subs_updated BEFORE UPDATE ON public.offering_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ commodity_trades + trade_documents ============
CREATE TABLE IF NOT EXISTS public.commodity_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text,
  lot_id uuid REFERENCES public.commodity_lots(id) ON DELETE SET NULL,
  inquiry_id uuid REFERENCES public.commodity_inquiries(id) ON DELETE SET NULL,
  buyer_user_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  commodity text,
  form text,
  quantity_t numeric,
  incoterm text,
  unit_price_usd numeric,
  total_value_usd numeric,
  currency text NOT NULL DEFAULT 'USD',
  payment_instrument text,
  stage text NOT NULL DEFAULT 'icpo',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_buyer ON public.commodity_trades(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_seller ON public.commodity_trades(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_lot ON public.commodity_trades(lot_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commodity_trades TO authenticated;
GRANT ALL ON public.commodity_trades TO service_role;
ALTER TABLE public.commodity_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view trade" ON public.commodity_trades FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());
CREATE POLICY "Party creates trade" ON public.commodity_trades FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid()));
CREATE POLICY "Parties update trade" ON public.commodity_trades FOR UPDATE TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());
CREATE TRIGGER trg_commodity_trades_updated BEFORE UPDATE ON public.commodity_trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  phase text,
  status text NOT NULL DEFAULT 'pending',
  file_url text,
  issuer text,
  reference text,
  signed_by uuid,
  signed_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_documents_trade ON public.trade_documents(trade_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_documents TO authenticated;
GRANT ALL ON public.trade_documents TO service_role;
ALTER TABLE public.trade_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view trade docs" ON public.trade_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_documents.trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Parties add trade docs" ON public.trade_documents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Parties update trade docs" ON public.trade_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_documents.trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Parties delete trade docs" ON public.trade_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_documents.trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE TRIGGER trg_trade_documents_updated BEFORE UPDATE ON public.trade_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ trade_events ============
CREATE TABLE IF NOT EXISTS public.trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  kind text NOT NULL,
  detail text,
  doc_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_events_trade ON public.trade_events(trade_id, created_at DESC);
GRANT SELECT, INSERT ON public.trade_events TO authenticated;
GRANT ALL ON public.trade_events TO service_role;
ALTER TABLE public.trade_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view trade events" ON public.trade_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_events.trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Parties add trade events" ON public.trade_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));

-- ============ trade_shipments (migración 20260718) ============
CREATE TABLE IF NOT EXISTS public.trade_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  reference text,
  vessel_name text,
  bl_number text,
  carrier text,
  container_count integer,
  quantity_t numeric,
  port_loading text,
  port_discharge text,
  etd date,
  eta date,
  status text NOT NULL DEFAULT 'preparing',
  tracking_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_shipments_trade ON public.trade_shipments(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_shipments_status ON public.trade_shipments(status, eta);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_shipments TO authenticated;
GRANT ALL ON public.trade_shipments TO service_role;
ALTER TABLE public.trade_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view shipments" ON public.trade_shipments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Party creates shipment" ON public.trade_shipments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE POLICY "Parties update shipment" ON public.trade_shipments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_trades t WHERE t.id = trade_id
    AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())));
CREATE TRIGGER trg_trade_shipments_updated BEFORE UPDATE ON public.trade_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ business_partners (migración 20260719) ============
CREATE TABLE IF NOT EXISTS public.business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  role text NOT NULL DEFAULT 'gestor',
  email text,
  phone text,
  country text,
  commodities text[] DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'activo',
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_partners_owner_idx ON public.business_partners (owner_user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_partners TO authenticated;
GRANT ALL ON public.business_partners TO service_role;
ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own partners" ON public.business_partners FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER trg_business_partners_updated_at BEFORE UPDATE ON public.business_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
