
-- Helper: has_app_role (super_admin/support). Idempotente.
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_app_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- ============================================================
-- ENUMs
-- ============================================================
CREATE TYPE public.commodity_kind AS ENUM (
  'cu_concentrate','zn_concentrate','pb_concentrate','cu_cathode',
  'au_dore','ag_dore','au_bullion','rare_earths','li_carbonate',
  'li_spodumene','fe_ore','sn_concentrate','mo_concentrate','co_hydroxide','ni_sulphate'
);

CREATE TYPE public.commodity_form AS ENUM (
  'concentrate','cathode','dore','bullion','oxide','carbonate','sulphate','ore','hydroxide'
);

CREATE TYPE public.commodity_lot_status AS ENUM (
  'draft','pending_verification','published','under_negotiation','sold','archived'
);

CREATE TYPE public.commodity_inquiry_status AS ENUM (
  'new','contacted','sample_requested','offer_sent','negotiating','closed_won','closed_lost'
);

CREATE TYPE public.commodity_buyer_role AS ENUM (
  'trader','refinery','smelter','offtaker','industrial_end_user','investor','other'
);

CREATE TYPE public.commodity_incoterm AS ENUM (
  'FOB','CIF','CFR','EXW','DAP','DDP','FCA'
);

CREATE TYPE public.commodity_frequency AS ENUM (
  'spot','monthly','quarterly','semiannual','annual_offtake'
);

CREATE TYPE public.commodity_kyc_status AS ENUM (
  'pending','verified','rejected'
);

-- ============================================================
-- commodity_certifications
-- ============================================================
CREATE TABLE public.commodity_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer TEXT,
  description TEXT,
  logo_url TEXT,
  verify_url_template TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commodity_certifications TO anon, authenticated;
GRANT ALL ON public.commodity_certifications TO service_role;
ALTER TABLE public.commodity_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Certifications are public" ON public.commodity_certifications
  FOR SELECT USING (true);
CREATE POLICY "Admins manage certifications" ON public.commodity_certifications
  FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'));

-- ============================================================
-- commodity_lots
-- ============================================================
CREATE TABLE public.commodity_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  commodity public.commodity_kind NOT NULL,
  form public.commodity_form NOT NULL,

  grade_pct NUMERIC(8,4),
  grade_unit TEXT DEFAULT '%',
  moisture_pct NUMERIC(6,3),
  deleterious_json JSONB DEFAULT '{}'::jsonb,

  tonnage_available_t NUMERIC(14,2),
  lot_size_t NUMERIC(14,2),
  frequency public.commodity_frequency DEFAULT 'spot',

  country TEXT NOT NULL,
  region TEXT,
  port_of_loading TEXT,
  origin_geojson JSONB,

  incoterm public.commodity_incoterm DEFAULT 'FOB',
  payment_terms TEXT,
  price_basis TEXT,
  premium_discount_usd_t NUMERIC(12,2),
  asking_price_usd NUMERIC(16,2),
  currency TEXT DEFAULT 'USD',

  certifications_json JSONB DEFAULT '[]'::jsonb,
  assay_report_url TEXT,
  chain_of_custody_json JSONB DEFAULT '{}'::jsonb,
  cover_image_url TEXT,
  summary TEXT,
  description TEXT,

  status public.commodity_lot_status NOT NULL DEFAULT 'draft',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  views_count INTEGER NOT NULL DEFAULT 0,
  inquiry_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commodity_lots_status ON public.commodity_lots(status);
CREATE INDEX idx_commodity_lots_country ON public.commodity_lots(country);
CREATE INDEX idx_commodity_lots_commodity ON public.commodity_lots(commodity);
CREATE INDEX idx_commodity_lots_seller ON public.commodity_lots(seller_user_id);
CREATE INDEX idx_commodity_lots_published ON public.commodity_lots(is_verified, status) WHERE is_verified = true AND status = 'published';

GRANT SELECT ON public.commodity_lots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commodity_lots TO authenticated;
GRANT ALL ON public.commodity_lots TO service_role;

ALTER TABLE public.commodity_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified published lots"
  ON public.commodity_lots FOR SELECT
  USING (status = 'published' AND is_verified = true);

CREATE POLICY "Sellers view own lots"
  ON public.commodity_lots FOR SELECT TO authenticated
  USING (auth.uid() = seller_user_id);

CREATE POLICY "Admins view all lots"
  ON public.commodity_lots FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'));

CREATE POLICY "Sellers create own lots"
  ON public.commodity_lots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Sellers update own lots"
  ON public.commodity_lots FOR UPDATE TO authenticated
  USING (auth.uid() = seller_user_id)
  WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Admins update any lot"
  ON public.commodity_lots FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'));

CREATE POLICY "Sellers delete own draft lots"
  ON public.commodity_lots FOR DELETE TO authenticated
  USING (auth.uid() = seller_user_id AND status IN ('draft','archived'));

-- ============================================================
-- commodity_lot_certifications
-- ============================================================
CREATE TABLE public.commodity_lot_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES public.commodity_lots(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES public.commodity_certifications(id) ON DELETE RESTRICT,
  certificate_number TEXT,
  issued_at DATE,
  expires_at DATE,
  verification_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lot_id, certification_id)
);

GRANT SELECT ON public.commodity_lot_certifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commodity_lot_certifications TO authenticated;
GRANT ALL ON public.commodity_lot_certifications TO service_role;

ALTER TABLE public.commodity_lot_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views certifications of visible lots"
  ON public.commodity_lot_certifications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.commodity_lots l
    WHERE l.id = lot_id AND l.status = 'published' AND l.is_verified = true
  ));

CREATE POLICY "Sellers view own lot certifications"
  ON public.commodity_lot_certifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()));

CREATE POLICY "Sellers manage own lot certifications"
  ON public.commodity_lot_certifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()));

-- ============================================================
-- commodity_inquiries
-- ============================================================
CREATE TABLE public.commodity_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES public.commodity_lots(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_role public.commodity_buyer_role NOT NULL DEFAULT 'trader',
  company_name TEXT,
  intended_use TEXT,
  target_volume_t NUMERIC(14,2),
  target_price_usd_t NUMERIC(12,2),
  message TEXT,
  nda_signed_at TIMESTAMPTZ,
  status public.commodity_inquiry_status NOT NULL DEFAULT 'new',
  seller_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commodity_inquiries_lot ON public.commodity_inquiries(lot_id);
CREATE INDEX idx_commodity_inquiries_buyer ON public.commodity_inquiries(buyer_user_id);

GRANT SELECT, INSERT, UPDATE ON public.commodity_inquiries TO authenticated;
GRANT ALL ON public.commodity_inquiries TO service_role;

ALTER TABLE public.commodity_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer views own inquiries"
  ON public.commodity_inquiries FOR SELECT TO authenticated
  USING (auth.uid() = buyer_user_id);

CREATE POLICY "Seller views inquiries on own lots"
  ON public.commodity_inquiries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()));

CREATE POLICY "Admins view all inquiries"
  ON public.commodity_inquiries FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'));

CREATE POLICY "Buyer creates own inquiry"
  ON public.commodity_inquiries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_user_id);

CREATE POLICY "Buyer updates own inquiry"
  ON public.commodity_inquiries FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_user_id)
  WITH CHECK (auth.uid() = buyer_user_id);

CREATE POLICY "Seller updates inquiries on own lots"
  ON public.commodity_inquiries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commodity_lots l WHERE l.id = lot_id AND l.seller_user_id = auth.uid()));

-- ============================================================
-- buyer_profiles
-- ============================================================
CREATE TABLE public.buyer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  country_hq TEXT,
  entity_type TEXT,
  annual_volume_usd NUMERIC(16,2),
  commodities_of_interest TEXT[] DEFAULT ARRAY[]::TEXT[],
  geographies_of_interest TEXT[] DEFAULT ARRAY[]::TEXT[],
  contact_phone TEXT,
  website TEXT,
  kyc_status public.commodity_kyc_status NOT NULL DEFAULT 'pending',
  kyc_verified_at TIMESTAMPTZ,
  kyc_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.buyer_profiles TO authenticated;
GRANT ALL ON public.buyer_profiles TO service_role;

ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own buyer profile"
  ON public.buyer_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all buyer profiles"
  ON public.buyer_profiles FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own buyer profile"
  ON public.buyer_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own buyer profile"
  ON public.buyer_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_commodity_certifications_updated_at
  BEFORE UPDATE ON public.commodity_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commodity_lots_updated_at
  BEFORE UPDATE ON public.commodity_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commodity_inquiries_updated_at
  BEFORE UPDATE ON public.commodity_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_buyer_profiles_updated_at
  BEFORE UPDATE ON public.buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Trigger to bump inquiry_count on lots
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_commodity_lot_inquiry_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.commodity_lots SET inquiry_count = inquiry_count + 1 WHERE id = NEW.lot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.commodity_lots SET inquiry_count = GREATEST(0, inquiry_count - 1) WHERE id = OLD.lot_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bump_lot_inquiry_count
  AFTER INSERT OR DELETE ON public.commodity_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.bump_commodity_lot_inquiry_count();

-- ============================================================
-- Seed certifications catalog
-- ============================================================
INSERT INTO public.commodity_certifications (code, name, issuer, description, category) VALUES
  ('LBMA_GD', 'LBMA Good Delivery', 'London Bullion Market Association', 'Estándar internacional para lingotes de oro y plata refinada.', 'refining'),
  ('RJC_COC', 'RJC Chain of Custody', 'Responsible Jewellery Council', 'Cadena de custodia responsable para metales preciosos.', 'chain_of_custody'),
  ('FAIRMINED', 'Fairmined', 'Alliance for Responsible Mining', 'Oro y plata de minería artesanal responsable.', 'responsible_mining'),
  ('ICMM', 'ICMM Mining Principles', 'International Council on Mining and Metals', '10 principios de minería responsable con desempeño verificado.', 'responsible_mining'),
  ('EITI', 'EITI Compliant', 'Extractive Industries Transparency Initiative', 'Transparencia en pagos e ingresos del sector extractivo.', 'transparency'),
  ('ISO_9001', 'ISO 9001', 'ISO', 'Sistema de gestión de calidad.', 'iso'),
  ('ISO_14001', 'ISO 14001', 'ISO', 'Sistema de gestión ambiental.', 'iso'),
  ('ISO_45001', 'ISO 45001', 'ISO', 'Sistema de gestión de salud y seguridad ocupacional.', 'iso'),
  ('COPPERMARK', 'The Copper Mark', 'The Copper Mark', 'Producción responsable de cobre.', 'commodity_specific'),
  ('IRMA', 'IRMA Standard', 'Initiative for Responsible Mining Assurance', 'Estándar global de minería responsable auditable.', 'responsible_mining');
