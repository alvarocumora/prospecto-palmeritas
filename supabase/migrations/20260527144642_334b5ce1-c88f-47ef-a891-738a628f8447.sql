
CREATE OR REPLACE FUNCTION public.lv_user_can_access_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.created_by = auth.uid()
  );
$$;

CREATE TABLE public.veins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  commodity text NOT NULL DEFAULT 'Cu',
  strike_deg numeric NOT NULL DEFAULT 0,
  dip_deg numeric NOT NULL DEFAULT 70,
  dip_dir_deg numeric NOT NULL DEFAULT 90,
  thickness_m numeric NOT NULL DEFAULT 3,
  length_m numeric NOT NULL DEFAULT 300,
  depth_top_m numeric NOT NULL DEFAULT 0,
  depth_bottom_m numeric NOT NULL DEFAULT 150,
  grade_estimate jsonb NOT NULL DEFAULT '{}'::jsonb,
  density_tm3 numeric NOT NULL DEFAULT 2.7,
  confidence text NOT NULL DEFAULT 'medium',
  geometry jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_veins_project ON public.veins(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veins TO authenticated;
GRANT SELECT ON public.veins TO anon;
GRANT ALL ON public.veins TO service_role;
ALTER TABLE public.veins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "veins_public_losverdes_read" ON public.veins FOR SELECT
  USING (project_id = '7a499b02-ecdf-447b-8956-b106fe4ec087'::uuid);
CREATE POLICY "veins_members_select" ON public.veins FOR SELECT TO authenticated
  USING (public.lv_user_can_access_project(project_id));
CREATE POLICY "veins_members_write" ON public.veins FOR ALL TO authenticated
  USING (public.lv_user_can_access_project(project_id))
  WITH CHECK (public.lv_user_can_access_project(project_id));

CREATE TABLE public.mine_plan_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  phase_no integer NOT NULL,
  name text NOT NULL,
  target_id uuid REFERENCES public.exploration_targets(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'open_pit',
  area_polygon jsonb,
  avg_thickness_m numeric NOT NULL DEFAULT 30,
  density_tm3 numeric NOT NULL DEFAULT 2.7,
  cutoff_grade numeric NOT NULL DEFAULT 0.3,
  recovery_pct numeric NOT NULL DEFAULT 85,
  capex_usd numeric NOT NULL DEFAULT 0,
  opex_usd_t numeric NOT NULL DEFAULT 0,
  metal_price_assumption jsonb NOT NULL DEFAULT '{}'::jsonb,
  grade_estimate jsonb NOT NULL DEFAULT '{}'::jsonb,
  start_year integer NOT NULL DEFAULT 1,
  duration_years integer NOT NULL DEFAULT 3,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mine_plan_phases_project ON public.mine_plan_phases(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mine_plan_phases TO authenticated;
GRANT SELECT ON public.mine_plan_phases TO anon;
GRANT ALL ON public.mine_plan_phases TO service_role;
ALTER TABLE public.mine_plan_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpp_public_losverdes_read" ON public.mine_plan_phases FOR SELECT
  USING (project_id = '7a499b02-ecdf-447b-8956-b106fe4ec087'::uuid);
CREATE POLICY "mpp_members_select" ON public.mine_plan_phases FOR SELECT TO authenticated
  USING (public.lv_user_can_access_project(project_id));
CREATE POLICY "mpp_members_write" ON public.mine_plan_phases FOR ALL TO authenticated
  USING (public.lv_user_can_access_project(project_id))
  WITH CHECK (public.lv_user_can_access_project(project_id));
