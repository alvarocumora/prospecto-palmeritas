-- Surveys
CREATE TABLE public.geophysics_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  planned_km NUMERIC,
  cost_usd NUMERIC,
  station_spacing_m NUMERIC,
  expected_depth_m NUMERIC,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.geophysics_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view geophysics_surveys" ON public.geophysics_surveys FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert own geophysics_surveys" ON public.geophysics_surveys FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update geophysics_surveys" ON public.geophysics_surveys FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete geophysics_surveys" ON public.geophysics_surveys FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER update_geophysics_surveys_updated_at BEFORE UPDATE ON public.geophysics_surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lines
CREATE TABLE public.geophysics_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.geophysics_surveys(id) ON DELETE CASCADE,
  line_id TEXT NOT NULL,
  geometry_geojson JSONB NOT NULL,
  length_m NUMERIC,
  notes TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.geophysics_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view geophysics_lines" ON public.geophysics_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert own geophysics_lines" ON public.geophysics_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update geophysics_lines" ON public.geophysics_lines FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete geophysics_lines" ON public.geophysics_lines FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER update_geophysics_lines_updated_at BEFORE UPDATE ON public.geophysics_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stations
CREATE TABLE public.geophysics_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.geophysics_surveys(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  mag_nt NUMERIC,
  ip_chargeability_mvv NUMERIC,
  ip_resistivity_ohmm NUMERIC,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.geophysics_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view geophysics_stations" ON public.geophysics_stations FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert own geophysics_stations" ON public.geophysics_stations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can update geophysics_stations" ON public.geophysics_stations FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete geophysics_stations" ON public.geophysics_stations FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER update_geophysics_stations_updated_at BEFORE UPDATE ON public.geophysics_stations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_geo_lines_survey ON public.geophysics_lines(survey_id);
CREATE INDEX idx_geo_stations_survey ON public.geophysics_stations(survey_id);