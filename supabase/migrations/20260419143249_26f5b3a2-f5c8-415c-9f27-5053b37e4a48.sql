-- Sprint 6.4 — DEM differencing results
CREATE TABLE public.dem_diffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  raster_before_id UUID NOT NULL REFERENCES public.drone_rasters(id) ON DELETE CASCADE,
  raster_after_id UUID NOT NULL REFERENCES public.drone_rasters(id) ON DELETE CASCADE,
  bbox_geojson JSONB,
  pixel_size_m NUMERIC,
  fill_volume_m3 NUMERIC,
  cut_volume_m3 NUMERIC,
  net_volume_m3 NUMERIC,
  cells_analyzed INTEGER,
  diff_min_m NUMERIC,
  diff_max_m NUMERIC,
  diff_mean_m NUMERIC,
  storage_path TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dem_diffs_project ON public.dem_diffs(project_id);

ALTER TABLE public.dem_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view dem_diffs" ON public.dem_diffs
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert dem_diffs" ON public.dem_diffs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','project_manager','geologist']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Editors update dem_diffs" ON public.dem_diffs
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete dem_diffs" ON public.dem_diffs
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_dem_diffs_updated
  BEFORE UPDATE ON public.dem_diffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sprint 6.5 — Stockpile volumes
CREATE TABLE public.stockpile_volumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  raster_id UUID NOT NULL REFERENCES public.drone_rasters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  material TEXT,
  polygon_geojson JSONB NOT NULL,
  base_method TEXT NOT NULL DEFAULT 'edge_mean',
  base_elevation_m NUMERIC,
  volume_m3 NUMERIC,
  area_m2 NUMERIC,
  mean_height_m NUMERIC,
  max_height_m NUMERIC,
  cells_analyzed INTEGER,
  pixel_size_m NUMERIC,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stockpile_project ON public.stockpile_volumes(project_id);
CREATE INDEX idx_stockpile_raster ON public.stockpile_volumes(raster_id);

ALTER TABLE public.stockpile_volumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view stockpile_volumes" ON public.stockpile_volumes
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert stockpile_volumes" ON public.stockpile_volumes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(),
      ARRAY['owner','admin','project_manager','geologist']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Editors update stockpile_volumes" ON public.stockpile_volumes
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete stockpile_volumes" ON public.stockpile_volumes
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_stockpile_volumes_updated
  BEFORE UPDATE ON public.stockpile_volumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();