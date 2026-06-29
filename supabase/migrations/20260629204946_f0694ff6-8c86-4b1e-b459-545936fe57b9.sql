
-- 1) Helper to identify Geocapitals staff (super_admin or account_type = 'geocapitals_team')
CREATE OR REPLACE FUNCTION public.is_geocapitals_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id AND p.account_type = 'geocapitals_team'
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_geocapitals_staff(uuid) TO authenticated, service_role;

-- 2) Terms acceptance on investor profile
ALTER TABLE public.investor_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 3) Staff can read and update investor profiles for approval workflow
DROP POLICY IF EXISTS "staff read investor profiles" ON public.investor_profiles;
CREATE POLICY "staff read investor profiles"
ON public.investor_profiles FOR SELECT
TO authenticated
USING (public.is_geocapitals_staff(auth.uid()));

DROP POLICY IF EXISTS "staff update investor profiles" ON public.investor_profiles;
CREATE POLICY "staff update investor profiles"
ON public.investor_profiles FOR UPDATE
TO authenticated
USING (public.is_geocapitals_staff(auth.uid()))
WITH CHECK (public.is_geocapitals_staff(auth.uid()));

-- 4) Staff can read all property deal inquiries
DROP POLICY IF EXISTS "staff read property deal inquiries" ON public.property_deal_inquiries;
CREATE POLICY "staff read property deal inquiries"
ON public.property_deal_inquiries FOR SELECT
TO authenticated
USING (public.is_geocapitals_staff(auth.uid()));

-- 5) Settlements table (admin/staff only)
CREATE TABLE IF NOT EXISTS public.deal_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.property_listings(id) ON DELETE SET NULL,
  inquiry_id uuid REFERENCES public.property_deal_inquiries(id) ON DELETE SET NULL,
  investor_user_id uuid,
  investor_company text,
  amount_usd numeric,
  amount_clp numeric,
  success_fee_pct numeric,
  status text NOT NULL DEFAULT 'pending_wire',
  stripe_invoice_id text,
  wire_reference text,
  notes text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_settlements_status_chk
    CHECK (status IN ('pending_wire','received','paid_out','cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_settlements TO authenticated;
GRANT ALL ON public.deal_settlements TO service_role;

ALTER TABLE public.deal_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage settlements"
ON public.deal_settlements FOR ALL
TO authenticated
USING (public.is_geocapitals_staff(auth.uid()))
WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_deal_settlements_status ON public.deal_settlements(status);
CREATE INDEX IF NOT EXISTS idx_deal_settlements_listing ON public.deal_settlements(listing_id);

-- updated_at trigger reusing existing helper if present, else create local
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS deal_settlements_set_updated_at ON public.deal_settlements;
CREATE TRIGGER deal_settlements_set_updated_at
BEFORE UPDATE ON public.deal_settlements
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
