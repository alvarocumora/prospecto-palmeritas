-- =========================================================
-- Tokenización de activos mineros (v1, off-chain / referencial).
--
-- Modela ofertas de participación fraccionada sobre un proyecto minero y las
-- suscripciones (compromisos) de los inversionistas. Es un registro de cap
-- table / SPV units: NO es una emisión on-chain ni una oferta pública de
-- valores; la UI lo enmarca como referencial y sujeto a documentación legal.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.asset_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  token_symbol text NOT NULL,
  title text NOT NULL,
  description text,
  instrument text NOT NULL DEFAULT 'participation', -- participation | royalty | equity | debt
  total_units integer NOT NULL CHECK (total_units > 0),
  price_per_unit_usd numeric NOT NULL CHECK (price_per_unit_usd >= 0),
  currency text NOT NULL DEFAULT 'USD',
  min_units integer NOT NULL DEFAULT 1 CHECK (min_units > 0),
  status text NOT NULL DEFAULT 'draft', -- draft | open | closed | cancelled
  terms_url text,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_offerings_project ON public.asset_offerings(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_offerings_status ON public.asset_offerings(status);
ALTER TABLE public.asset_offerings ENABLE ROW LEVEL SECURITY;

-- Ofertas abiertas visibles para cualquier autenticado; borradores solo miembros.
CREATE POLICY "View open offerings or own project"
  ON public.asset_offerings FOR SELECT TO authenticated
  USING (status <> 'draft' OR is_project_member(project_id, auth.uid()));

CREATE POLICY "Owners create offerings"
  ON public.asset_offerings FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner', 'admin']::public.project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Owners update offerings"
  ON public.asset_offerings FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner', 'admin']::public.project_role[]));

CREATE POLICY "Owners delete offerings"
  ON public.asset_offerings FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner', 'admin']::public.project_role[]));

CREATE TRIGGER trg_asset_offerings_updated
  BEFORE UPDATE ON public.asset_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- offering_subscriptions: compromisos de inversionistas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.offering_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.asset_offerings(id) ON DELETE CASCADE,
  investor_user_id uuid NOT NULL,
  units integer NOT NULL CHECK (units > 0),
  amount_usd numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | cancelled
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offering_subs_offering ON public.offering_subscriptions(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_subs_investor ON public.offering_subscriptions(investor_user_id);
ALTER TABLE public.offering_subscriptions ENABLE ROW LEVEL SECURITY;

-- El inversionista ve las suyas; el dueño del proyecto ve las de sus ofertas.
CREATE POLICY "View own subs or as offering owner"
  ON public.offering_subscriptions FOR SELECT TO authenticated
  USING (
    investor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asset_offerings o
      WHERE o.id = offering_subscriptions.offering_id
        AND has_project_role(o.project_id, auth.uid(), ARRAY['owner', 'admin']::public.project_role[])
    )
  );

CREATE POLICY "Investor creates own subscription"
  ON public.offering_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    investor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.asset_offerings o
      WHERE o.id = offering_id AND o.status = 'open'
    )
  );

-- El inversionista actualiza las suyas (cancelar); el dueño confirma/rechaza.
CREATE POLICY "Investor or owner updates subscription"
  ON public.offering_subscriptions FOR UPDATE TO authenticated
  USING (
    investor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asset_offerings o
      WHERE o.id = offering_subscriptions.offering_id
        AND has_project_role(o.project_id, auth.uid(), ARRAY['owner', 'admin']::public.project_role[])
    )
  );

CREATE TRIGGER trg_offering_subs_updated
  BEFORE UPDATE ON public.offering_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
