
-- === 1. commodity_inquiry_messages ===
CREATE TABLE IF NOT EXISTS public.commodity_inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.commodity_inquiries(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commodity_inquiry_messages_inquiry_idx
  ON public.commodity_inquiry_messages (inquiry_id, created_at);
ALTER TABLE public.commodity_inquiry_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants read inquiry messages" ON public.commodity_inquiry_messages;
CREATE POLICY "Participants read inquiry messages"
ON public.commodity_inquiry_messages
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.commodity_inquiries i JOIN public.commodity_lots l ON l.id = i.lot_id
  WHERE i.id = commodity_inquiry_messages.inquiry_id AND (i.buyer_user_id = auth.uid() OR l.seller_user_id = auth.uid())));
DROP POLICY IF EXISTS "Participants send inquiry messages" ON public.commodity_inquiry_messages;
CREATE POLICY "Participants send inquiry messages"
ON public.commodity_inquiry_messages
FOR INSERT TO authenticated
WITH CHECK (sender_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.commodity_inquiries i JOIN public.commodity_lots l ON l.id = i.lot_id
  WHERE i.id = commodity_inquiry_messages.inquiry_id AND (i.buyer_user_id = auth.uid() OR l.seller_user_id = auth.uid())));
GRANT SELECT, INSERT ON public.commodity_inquiry_messages TO authenticated;
GRANT ALL ON public.commodity_inquiry_messages TO service_role;

-- === 2. seed billing_plans ===
INSERT INTO public.billing_plans
  (code, name, description, price_usd_monthly, price_usd_yearly,
   max_projects, max_members, max_storage_gb, max_ai_calls_per_month,
   features, is_active, is_default, display_order)
VALUES
  ('free', 'Free', 'Acceso al mapa nacional y búsqueda ilimitada de concesiones.',
    0, 0, 1, 1, 1, 20,
    '["Mapa nacional SERNAGEOMIN en vivo","Búsqueda ilimitada de concesiones","Ficha pública por concesión","Watchlist hasta 3 concesiones"]'::jsonb,
    true, true, 1),
  ('pro', 'Pro', 'Monitoreo activo con alertas, AOI y exportes para due diligence.',
    49, 490, 20, 5, 50, 500,
    '["Todo lo de Free","Watchlist hasta 50 concesiones","Alertas por email y push","AOI ilimitadas con análisis de traslapes","20 exportes PDF / GeoJSON al mes","Sin marca de agua"]'::jsonb,
    true, false, 2),
  ('enterprise', 'Enterprise', 'Escala institucional: multi-usuario, API y soporte con SLA.',
    299, 2990, 999, 50, 1000, 5000,
    '["Todo lo de Pro","Watchlist ilimitado","Exportes Shapefile y API","Multi-usuario y roles","Reportes due-diligence batch","Soporte prioritario","SLA y onboarding"]'::jsonb,
    true, false, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_usd_monthly = EXCLUDED.price_usd_monthly, price_usd_yearly = EXCLUDED.price_usd_yearly,
  max_projects = EXCLUDED.max_projects, max_members = EXCLUDED.max_members,
  max_storage_gb = EXCLUDED.max_storage_gb, max_ai_calls_per_month = EXCLUDED.max_ai_calls_per_month,
  features = EXCLUDED.features, is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default, display_order = EXCLUDED.display_order,
  updated_at = now();
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reads active plans" ON public.billing_plans;
CREATE POLICY "Public reads active plans"
ON public.billing_plans
FOR SELECT TO anon, authenticated
USING (is_active = true);
GRANT SELECT ON public.billing_plans TO anon, authenticated;

-- === 3. payment_orders ===
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_code text NOT NULL,
  billing text NOT NULL CHECK (billing IN ('monthly','yearly')),
  amount_clp integer NOT NULL,
  amount_usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled')),
  provider text NOT NULL DEFAULT 'mercadopago',
  preference_id text,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON public.payment_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS payment_orders_payment_idx ON public.payment_orders (payment_id);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own orders" ON public.payment_orders;
CREATE POLICY "Users read own orders"
ON public.payment_orders
FOR SELECT TO authenticated
USING (user_id = auth.uid());
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;

-- === 4. patent_remates ===
CREATE TABLE IF NOT EXISTS public.patent_remates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  rol text,
  dv_rol text,
  concession_code text,
  concession_name text,
  holder_name text,
  holder_rut text,
  region text,
  comuna text,
  concession_type text,
  years_owed integer,
  amount_clp numeric,
  court text,
  court_role text,
  status text NOT NULL DEFAULT 'nomina',
  source text NOT NULL DEFAULT 'sernageomin-amparo',
  source_url text,
  raw_payload jsonb,
  content_hash text NOT NULL UNIQUE,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patent_remates_code ON public.patent_remates(concession_code) WHERE concession_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patent_remates_year ON public.patent_remates(year DESC);
CREATE INDEX IF NOT EXISTS idx_patent_remates_rut ON public.patent_remates(holder_rut) WHERE holder_rut IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patent_remates_name ON public.patent_remates(concession_name);
ALTER TABLE public.patent_remates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patent_remates TO authenticated;
GRANT ALL ON public.patent_remates TO service_role;
DROP POLICY IF EXISTS "Authenticated users view remates" ON public.patent_remates;
CREATE POLICY "Authenticated users view remates"
  ON public.patent_remates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admins insert remates" ON public.patent_remates;
CREATE POLICY "Super admins insert remates"
  ON public.patent_remates FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admins update remates" ON public.patent_remates;
CREATE POLICY "Super admins update remates"
  ON public.patent_remates FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Super admins delete remates" ON public.patent_remates;
CREATE POLICY "Super admins delete remates"
  ON public.patent_remates FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS update_patent_remates_updated_at ON public.patent_remates;
CREATE TRIGGER update_patent_remates_updated_at
  BEFORE UPDATE ON public.patent_remates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === 5. advance_requests ===
CREATE TABLE IF NOT EXISTS public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.commodity_lots(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL,
  eligibility text NOT NULL,
  advance_rate_pct integer NOT NULL,
  max_advance_usd numeric NOT NULL,
  lot_value_usd numeric,
  risk_score integer,
  indicative_fee_pct numeric,
  tenor_days integer,
  offer_snapshot jsonb,
  requested_amount_usd numeric NOT NULL,
  purpose text,
  status text NOT NULL DEFAULT 'requested',
  reviewer_user_id uuid,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_advance_requests_requester ON public.advance_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_lot ON public.advance_requests(lot_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_status ON public.advance_requests(status, created_at DESC);
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_requests TO authenticated;
GRANT ALL ON public.advance_requests TO service_role;
DROP POLICY IF EXISTS "Requester or funder views advance requests" ON public.advance_requests;
CREATE POLICY "Requester or funder views advance requests"
  ON public.advance_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Requester creates advance request" ON public.advance_requests;
CREATE POLICY "Requester creates advance request"
  ON public.advance_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());
DROP POLICY IF EXISTS "Requester or funder updates advance request" ON public.advance_requests;
CREATE POLICY "Requester or funder updates advance request"
  ON public.advance_requests FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() OR is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_advance_requests_updated ON public.advance_requests;
CREATE TRIGGER trg_advance_requests_updated
  BEFORE UPDATE ON public.advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === 6. api_keys ===
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'default',
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  is_active boolean NOT NULL DEFAULT true,
  monthly_count integer NOT NULL DEFAULT 0,
  month_key text,
  requests_total integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
DROP POLICY IF EXISTS "Owner views own api keys" ON public.api_keys;
CREATE POLICY "Owner views own api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner creates own api keys" ON public.api_keys;
CREATE POLICY "Owner creates own api keys"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner updates own api keys" ON public.api_keys;
CREATE POLICY "Owner updates own api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
DROP TRIGGER IF EXISTS trg_api_keys_updated ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
