-- Phase A: Operational Center DB foundation

-- Exploration campaigns
CREATE TABLE public.exploration_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  phase text NOT NULL DEFAULT 'recon',
  status text NOT NULL DEFAULT 'active',
  started_at date,
  ended_at date,
  aoi_geojson jsonb,
  lead_user_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exploration_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view campaigns" ON public.exploration_campaigns
  FOR SELECT TO authenticated USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Editors insert campaigns" ON public.exploration_campaigns
  FOR INSERT TO authenticated WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "Editors update campaigns" ON public.exploration_campaigns
  FOR UPDATE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
  );
CREATE POLICY "Admins delete campaigns" ON public.exploration_campaigns
  FOR DELETE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER update_exploration_campaigns_updated_at
  BEFORE UPDATE ON public.exploration_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drone flights
CREATE TABLE public.drone_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  sensor text NOT NULL DEFAULT 'rgb',
  pilot text,
  flown_at date,
  altitude_m numeric,
  area_ha numeric,
  geometry_geojson jsonb,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drone_flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view drone_flights" ON public.drone_flights
  FOR SELECT TO authenticated USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Editors insert drone_flights" ON public.drone_flights
  FOR INSERT TO authenticated WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "Editors update drone_flights" ON public.drone_flights
  FOR UPDATE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
  );
CREATE POLICY "Admins delete drone_flights" ON public.drone_flights
  FOR DELETE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER update_drone_flights_updated_at
  BEFORE UPDATE ON public.drone_flights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drone rasters (overlays)
CREATE TABLE public.drone_rasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  flight_id uuid REFERENCES public.drone_flights(id) ON DELETE SET NULL,
  name text NOT NULL,
  raster_type text NOT NULL DEFAULT 'ortho',
  url text NOT NULL,
  bounds_geojson jsonb,
  captured_at date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drone_rasters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view drone_rasters" ON public.drone_rasters
  FOR SELECT TO authenticated USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Editors insert drone_rasters" ON public.drone_rasters
  FOR INSERT TO authenticated WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "Editors update drone_rasters" ON public.drone_rasters
  FOR UPDATE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::project_role[])
  );
CREATE POLICY "Admins delete drone_rasters" ON public.drone_rasters
  FOR DELETE TO authenticated USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER update_drone_rasters_updated_at
  BEFORE UPDATE ON public.drone_rasters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saved map views (per user)
CREATE TABLE public.map_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  layer_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  center_lat numeric,
  center_lng numeric,
  zoom numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own map_views" ON public.map_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own map_views" ON public.map_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND is_project_member(project_id, auth.uid()));
CREATE POLICY "Users update own map_views" ON public.map_views
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own map_views" ON public.map_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_map_views_updated_at
  BEFORE UPDATE ON public.map_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add campaign_id to existing tables for temporal filtering
ALTER TABLE public.geophysics_surveys ADD COLUMN campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.sampling_results ADD COLUMN campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.drill_holes ADD COLUMN campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_geophysics_surveys_campaign ON public.geophysics_surveys(campaign_id);
CREATE INDEX idx_sampling_results_campaign ON public.sampling_results(campaign_id);
CREATE INDEX idx_drill_holes_campaign ON public.drill_holes(campaign_id);
CREATE INDEX idx_drone_flights_project ON public.drone_flights(project_id);
CREATE INDEX idx_drone_rasters_project ON public.drone_rasters(project_id);
CREATE INDEX idx_exploration_campaigns_project ON public.exploration_campaigns(project_id);
CREATE INDEX idx_map_views_user_project ON public.map_views(user_id, project_id);