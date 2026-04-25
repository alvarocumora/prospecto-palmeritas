-- =====================================================
-- M3a · Motor Económico NSR/NPV
-- =====================================================

CREATE TABLE public.economic_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.resource_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- Precios y recovery
  commodity_price_usd numeric NOT NULL DEFAULT 2000, -- USD/oz para Au/Ag, USD/t para Cu
  price_unit text NOT NULL DEFAULT 'usd_per_oz', -- usd_per_oz | usd_per_t | usd_per_lb
  recovery_pct numeric NOT NULL DEFAULT 90 CHECK (recovery_pct >= 0 AND recovery_pct <= 100),
  payable_pct numeric NOT NULL DEFAULT 99 CHECK (payable_pct >= 0 AND payable_pct <= 100),
  -- Costos USD/t mineral
  mining_cost_usd_t numeric NOT NULL DEFAULT 3.5,
  processing_cost_usd_t numeric NOT NULL DEFAULT 18,
  ga_cost_usd_t numeric NOT NULL DEFAULT 2.5,
  -- Costos USD/t estéril
  waste_cost_usd_t numeric NOT NULL DEFAULT 2.8,
  -- Regalías y refining
  royalty_pct numeric NOT NULL DEFAULT 3 CHECK (royalty_pct >= 0 AND royalty_pct <= 100),
  refining_cost_usd_oz numeric NOT NULL DEFAULT 5,
  transport_cost_usd_t numeric NOT NULL DEFAULT 4,
  -- Pit / scheduling
  slope_angle_deg numeric NOT NULL DEFAULT 45 CHECK (slope_angle_deg > 0 AND slope_angle_deg < 90),
  annual_throughput_t numeric NOT NULL DEFAULT 1000000,
  discount_rate_pct numeric NOT NULL DEFAULT 8,
  ramp_up_years integer NOT NULL DEFAULT 1,
  capex_usd numeric NOT NULL DEFAULT 50000000,
  sustaining_capex_usd_t numeric NOT NULL DEFAULT 1.5,
  -- Resultados cacheados
  status text NOT NULL DEFAULT 'draft', -- draft | running | complete | failed
  nsr_cutoff_usd_t numeric,
  ore_tonnes numeric,
  waste_tonnes numeric,
  strip_ratio numeric,
  mean_grade numeric,
  metal_payable numeric,
  gross_revenue_usd numeric,
  total_opex_usd numeric,
  total_capex_usd numeric,
  ebitda_usd numeric,
  npv_usd numeric,
  irr_pct numeric,
  payback_years numeric,
  mine_life_years numeric,
  notes text,
  computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE INDEX idx_economic_scenarios_model ON public.economic_scenarios(model_id);
CREATE INDEX idx_economic_scenarios_project ON public.economic_scenarios(project_id);

CREATE TABLE public.resource_block_economics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.economic_scenarios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.resource_blocks(id) ON DELETE CASCADE,
  nsr_usd_t numeric,           -- Net Smelter Return per tonne ore
  insitu_value_usd numeric,    -- nsr * tonnage of block
  total_cost_usd_t numeric,
  margin_usd_t numeric,
  in_pit boolean NOT NULL DEFAULT false,
  is_ore boolean NOT NULL DEFAULT false,
  extraction_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, block_id)
);

CREATE INDEX idx_block_econ_scenario ON public.resource_block_economics(scenario_id);
CREATE INDEX idx_block_econ_project ON public.resource_block_economics(project_id);

CREATE TABLE public.economic_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.economic_scenarios(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  ore_tonnes numeric NOT NULL DEFAULT 0,
  waste_tonnes numeric NOT NULL DEFAULT 0,
  mean_grade numeric,
  metal_payable numeric NOT NULL DEFAULT 0,
  revenue_usd numeric NOT NULL DEFAULT 0,
  opex_usd numeric NOT NULL DEFAULT 0,
  capex_usd numeric NOT NULL DEFAULT 0,
  cashflow_usd numeric NOT NULL DEFAULT 0,
  discounted_cashflow_usd numeric NOT NULL DEFAULT 0,
  cumulative_cashflow_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, year)
);

CREATE INDEX idx_econ_schedule_scenario ON public.economic_schedule(scenario_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_economic_scenario()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft','running','complete','failed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.price_unit NOT IN ('usd_per_oz','usd_per_t','usd_per_lb') THEN
    RAISE EXCEPTION 'Invalid price_unit: %', NEW.price_unit;
  END IF;
  IF NEW.commodity_price_usd <= 0 THEN
    RAISE EXCEPTION 'commodity_price_usd must be > 0';
  END IF;
  IF NEW.annual_throughput_t <= 0 THEN
    RAISE EXCEPTION 'annual_throughput_t must be > 0';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_economic_scenario
  BEFORE INSERT OR UPDATE ON public.economic_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.validate_economic_scenario();

CREATE TRIGGER trg_economic_scenarios_updated
  BEFORE UPDATE ON public.economic_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.economic_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_block_economics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view scenarios" ON public.economic_scenarios
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create scenarios" ON public.economic_scenarios
  FOR INSERT WITH CHECK (public.is_project_member(project_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Members update scenarios" ON public.economic_scenarios
  FOR UPDATE USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Owners delete scenarios" ON public.economic_scenarios
  FOR DELETE USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE POLICY "Members view block economics" ON public.resource_block_economics
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write block economics" ON public.resource_block_economics
  FOR ALL USING (public.is_project_member(project_id, auth.uid())) WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members view schedule" ON public.economic_schedule
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members write schedule" ON public.economic_schedule
  FOR ALL USING (public.is_project_member(project_id, auth.uid())) WITH CHECK (public.is_project_member(project_id, auth.uid()));