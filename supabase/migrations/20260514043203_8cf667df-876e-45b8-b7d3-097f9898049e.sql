-- Catálogo de minerales detectables
CREATE TYPE public.hyperspectral_mineral AS ENUM (
  'kaolinite','alunite','illite','sericite','muscovite','montmorillonite',
  'chlorite','epidote','calcite','dolomite',
  'hematite','goethite','jarosite','pyrite_oxidized',
  'gypsum','silica','other'
);

CREATE TYPE public.alteration_assemblage AS ENUM (
  'argillic','advanced_argillic','phyllic','propylitic','potassic',
  'iron_oxide_gossan','silicic_cap','unclassified'
);

-- ============ HYPERSPECTRAL PRODUCTS ============
CREATE TABLE public.hyperspectral_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('EMIT','EnMAP','PRISMA','ASTER','Sentinel-2')),
  acquisition_date TIMESTAMPTZ NOT NULL,
  scene_id TEXT,
  stac_href TEXT,
  bbox_geojson JSONB NOT NULL,
  pixel_size_m NUMERIC,
  cloud_pct NUMERIC,
  mineral hyperspectral_mineral NOT NULL,
  assemblage alteration_assemblage,
  cog_url TEXT,
  thumbnail_url TEXT,
  area_ha NUMERIC,
  mean_score NUMERIC,
  max_score NUMERIC,
  cells_above_threshold INT,
  threshold NUMERIC,
  algorithm TEXT NOT NULL DEFAULT 'SAM',
  spectral_library TEXT DEFAULT 'USGS_v7',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hyperspectral_project ON public.hyperspectral_products(project_id);
CREATE INDEX idx_hyperspectral_mineral ON public.hyperspectral_products(project_id, mineral);
CREATE INDEX idx_hyperspectral_date ON public.hyperspectral_products(project_id, acquisition_date DESC);

ALTER TABLE public.hyperspectral_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY hyperspectral_select ON public.hyperspectral_products
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY hyperspectral_insert ON public.hyperspectral_products
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','geologist','project_manager','chief_geologist']::project_role[])
  );
CREATE POLICY hyperspectral_update ON public.hyperspectral_products
  FOR UPDATE USING (
    auth.uid() = created_by OR
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','project_manager']::project_role[])
  );
CREATE POLICY hyperspectral_delete ON public.hyperspectral_products
  FOR DELETE USING (
    auth.uid() = created_by OR
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER trg_hyperspectral_updated
  BEFORE UPDATE ON public.hyperspectral_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INSAR DISPLACEMENT ============
CREATE TABLE public.insar_displacement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_name TEXT,
  asset_type TEXT CHECK (asset_type IN ('tailings_dam','open_pit','plant','waste_dump','road','other')),
  source TEXT NOT NULL DEFAULT 'OPERA_DISP_S1' CHECK (source IN ('OPERA_DISP_S1','HyP3','MintPy','PyGMTSAR','manual')),
  reference_date DATE NOT NULL,
  end_date DATE NOT NULL,
  bbox_geojson JSONB NOT NULL,
  point_geojson JSONB NOT NULL,
  velocity_mm_year NUMERIC NOT NULL,
  cumulative_displacement_mm NUMERIC,
  coherence NUMERIC CHECK (coherence BETWEEN 0 AND 1),
  ascending BOOLEAN,
  los_vector JSONB,
  time_series JSONB,
  alert_severity TEXT CHECK (alert_severity IN ('info','warning','critical')),
  cog_url TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insar_project ON public.insar_displacement(project_id);
CREATE INDEX idx_insar_velocity ON public.insar_displacement(project_id, velocity_mm_year);
CREATE INDEX idx_insar_severity ON public.insar_displacement(project_id, alert_severity);
CREATE INDEX idx_insar_dates ON public.insar_displacement(project_id, end_date DESC);

ALTER TABLE public.insar_displacement ENABLE ROW LEVEL SECURITY;
CREATE POLICY insar_select ON public.insar_displacement
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY insar_insert ON public.insar_displacement
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','geologist','project_manager','chief_geologist']::project_role[])
  );
CREATE POLICY insar_update ON public.insar_displacement
  FOR UPDATE USING (
    auth.uid() = created_by OR
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','project_manager']::project_role[])
  );
CREATE POLICY insar_delete ON public.insar_displacement
  FOR DELETE USING (
    auth.uid() = created_by OR
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER trg_insar_updated
  BEFORE UPDATE ON public.insar_displacement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STAC ACQUISITIONS CATALOG ============
CREATE TABLE public.stac_acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  stac_href TEXT,
  acquisition_date TIMESTAMPTZ NOT NULL,
  bbox_geojson JSONB NOT NULL,
  cloud_pct NUMERIC,
  thumbnail_url TEXT,
  assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, collection, scene_id)
);
CREATE INDEX idx_stac_project_collection ON public.stac_acquisitions(project_id, collection, acquisition_date DESC);

ALTER TABLE public.stac_acquisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY stac_select ON public.stac_acquisitions
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY stac_insert ON public.stac_acquisitions
  FOR INSERT WITH CHECK (
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','geologist','project_manager','chief_geologist']::project_role[])
  );
CREATE POLICY stac_delete ON public.stac_acquisitions
  FOR DELETE USING (
    public.has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin']::project_role[])
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hyperspectral_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.insar_displacement;