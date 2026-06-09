
CREATE TABLE IF NOT EXISTS public.cadastre_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_id uuid NOT NULL REFERENCES public.cadastre_national(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL DEFAULT 0,
  commodity_hint text[] NOT NULL DEFAULT '{}',
  region text,
  commune text,
  area_ha numeric,
  holder_name text,
  holder_rut text,
  nearest_deposit_id uuid REFERENCES public.mineral_deposits(id) ON DELETE SET NULL,
  nearest_deposit_name text,
  nearest_deposit_commodity text,
  deposit_proximity_km numeric,
  anomaly_overlap_count integer NOT NULL DEFAULT 0,
  patent_status text,
  expiry_risk text,
  holder_risk_score numeric,
  ai_thesis text,
  ai_action text,
  ai_confidence numeric,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concession_id)
);

GRANT SELECT ON public.cadastre_opportunities TO authenticated;
GRANT ALL ON public.cadastre_opportunities TO service_role;

ALTER TABLE public.cadastre_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read opportunities"
  ON public.cadastre_opportunities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages opportunities"
  ON public.cadastre_opportunities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cadastre_opportunities_score_idx
  ON public.cadastre_opportunities (score DESC);
CREATE INDEX IF NOT EXISTS cadastre_opportunities_region_idx
  ON public.cadastre_opportunities (region, commune);
CREATE INDEX IF NOT EXISTS cadastre_opportunities_commodity_idx
  ON public.cadastre_opportunities USING gin (commodity_hint);
CREATE INDEX IF NOT EXISTS cadastre_opportunities_holder_idx
  ON public.cadastre_opportunities (holder_rut);

CREATE OR REPLACE FUNCTION public.cadastre_opportunities_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cadastre_opportunities_updated_at ON public.cadastre_opportunities;
CREATE TRIGGER trg_cadastre_opportunities_updated_at
  BEFORE UPDATE ON public.cadastre_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.cadastre_opportunities_set_updated_at();
