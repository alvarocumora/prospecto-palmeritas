-- M2: Geostatistical Resource Estimation

CREATE TABLE IF NOT EXISTS public.resource_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  commodity text NOT NULL DEFAULT 'au',
  method text NOT NULL DEFAULT 'idw',
  cutoff_grade numeric,
  density_t_m3 numeric NOT NULL DEFAULT 2.7,
  block_size_x numeric NOT NULL DEFAULT 10,
  block_size_y numeric NOT NULL DEFAULT 10,
  block_size_z numeric NOT NULL DEFAULT 5,
  search_radius numeric NOT NULL DEFAULT 50,
  min_samples integer NOT NULL DEFAULT 2,
  max_samples integer NOT NULL DEFAULT 12,
  power numeric NOT NULL DEFAULT 2,
  composite_length numeric NOT NULL DEFAULT 2,
  bbox_min_x numeric, bbox_max_x numeric,
  bbox_min_y numeric, bbox_max_y numeric,
  bbox_min_z numeric, bbox_max_z numeric,
  blocks_total integer DEFAULT 0,
  blocks_estimated integer DEFAULT 0,
  composites_count integer DEFAULT 0,
  tonnage_total numeric,
  tonnage_above_cutoff numeric,
  mean_grade numeric,
  metal_content numeric,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  estimated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.resource_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.resource_models(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ix integer NOT NULL, iy integer NOT NULL, iz integer NOT NULL,
  x numeric NOT NULL, y numeric NOT NULL, z numeric NOT NULL,
  grade numeric, variance numeric,
  n_samples integer NOT NULL DEFAULT 0,
  nearest_dist numeric,
  classification text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_blocks_model ON public.resource_blocks(model_id);
CREATE INDEX IF NOT EXISTS idx_resource_blocks_project ON public.resource_blocks(project_id);

CREATE TABLE IF NOT EXISTS public.resource_composites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.resource_models(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hole_id uuid REFERENCES public.drill_holes(id) ON DELETE SET NULL,
  hole_code text,
  depth_from numeric NOT NULL, depth_to numeric NOT NULL,
  length_m numeric NOT NULL,
  grade numeric NOT NULL,
  x numeric NOT NULL, y numeric NOT NULL, z numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_composites_model ON public.resource_composites(model_id);

CREATE OR REPLACE FUNCTION public.validate_resource_model()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.method NOT IN ('idw','ok','nn') THEN
    RAISE EXCEPTION 'Invalid method: % (use idw, ok or nn)', NEW.method;
  END IF;
  IF NEW.commodity NOT IN ('au','ag','cu','zn','pb','mo','fe','li','other') THEN
    RAISE EXCEPTION 'Invalid commodity: %', NEW.commodity;
  END IF;
  IF NEW.status NOT IN ('draft','running','complete','failed','archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.density_t_m3 <= 0 THEN
    RAISE EXCEPTION 'density_t_m3 must be > 0';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_resource_model ON public.resource_models;
CREATE TRIGGER trg_validate_resource_model
  BEFORE INSERT OR UPDATE ON public.resource_models
  FOR EACH ROW EXECUTE FUNCTION public.validate_resource_model();

DROP TRIGGER IF EXISTS trg_resource_models_updated ON public.resource_models;
CREATE TRIGGER trg_resource_models_updated
  BEFORE UPDATE ON public.resource_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.resource_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_composites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read resource_models" ON public.resource_models
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "writers insert resource_models" ON public.resource_models
  FOR INSERT WITH CHECK (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "writers update resource_models" ON public.resource_models
  FOR UPDATE USING (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "writers delete resource_models" ON public.resource_models
  FOR DELETE USING (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "members read resource_blocks" ON public.resource_blocks
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "writers insert resource_blocks" ON public.resource_blocks
  FOR INSERT WITH CHECK (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "writers delete resource_blocks" ON public.resource_blocks
  FOR DELETE USING (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "members read resource_composites" ON public.resource_composites
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "writers insert resource_composites" ON public.resource_composites
  FOR INSERT WITH CHECK (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "writers delete resource_composites" ON public.resource_composites
  FOR DELETE USING (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
    OR public.is_super_admin(auth.uid())
  );