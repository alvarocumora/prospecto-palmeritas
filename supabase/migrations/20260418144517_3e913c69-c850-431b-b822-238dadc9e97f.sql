-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- sampling_results
-- =========================================================
CREATE TABLE public.sampling_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_code TEXT NOT NULL,
  sample_type TEXT NOT NULL CHECK (sample_type IN ('chip','canal','grab','soil','rock','polished')),
  zone TEXT,
  easting NUMERIC,
  northing NUMERIC,
  elevation NUMERIC,
  depth_from NUMERIC,
  depth_to NUMERIC,
  au_gpt NUMERIC,
  ag_gpt NUMERIC,
  cu_pct NUMERIC,
  mo_ppm NUMERIC,
  pb_ppm NUMERIC,
  zn_ppm NUMERIC,
  as_ppm NUMERIC,
  sb_ppm NUMERIC,
  hg_ppm NUMERIC,
  lab TEXT,
  certificate TEXT,
  sampled_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sampling_results_sample_code ON public.sampling_results(sample_code);
CREATE INDEX idx_sampling_results_zone ON public.sampling_results(zone);
CREATE INDEX idx_sampling_results_created_by ON public.sampling_results(created_by);

ALTER TABLE public.sampling_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sampling_results"
  ON public.sampling_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert own sampling_results"
  ON public.sampling_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can update sampling_results"
  ON public.sampling_results FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Owner can delete sampling_results"
  ON public.sampling_results FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_sampling_results_updated_at
  BEFORE UPDATE ON public.sampling_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- drill_holes
-- =========================================================
CREATE TABLE public.drill_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hole_id TEXT NOT NULL UNIQUE,
  easting NUMERIC,
  northing NUMERIC,
  elevation NUMERIC,
  azimuth NUMERIC,
  dip NUMERIC,
  planned_depth NUMERIC,
  actual_depth NUMERIC,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','permitted','in_progress','completed','abandoned')),
  target_zone TEXT,
  started_at DATE,
  completed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drill_holes_status ON public.drill_holes(status);
CREATE INDEX idx_drill_holes_created_by ON public.drill_holes(created_by);

ALTER TABLE public.drill_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view drill_holes"
  ON public.drill_holes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert own drill_holes"
  ON public.drill_holes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can update drill_holes"
  ON public.drill_holes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Owner can delete drill_holes"
  ON public.drill_holes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_drill_holes_updated_at
  BEFORE UPDATE ON public.drill_holes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- drill_core_logs
-- =========================================================
CREATE TABLE public.drill_core_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hole_id UUID NOT NULL REFERENCES public.drill_holes(id) ON DELETE CASCADE,
  depth_from NUMERIC NOT NULL,
  depth_to NUMERIC NOT NULL,
  lithology TEXT,
  alteration TEXT,
  mineralization TEXT,
  structure TEXT,
  recovery_pct NUMERIC,
  rqd_pct NUMERIC,
  vein_pct NUMERIC,
  sulfide_pct NUMERIC,
  au_gpt NUMERIC,
  ag_gpt NUMERIC,
  cu_pct NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (depth_to > depth_from)
);

CREATE INDEX idx_drill_core_logs_hole ON public.drill_core_logs(hole_id, depth_from);
CREATE INDEX idx_drill_core_logs_created_by ON public.drill_core_logs(created_by);

ALTER TABLE public.drill_core_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view drill_core_logs"
  ON public.drill_core_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert own drill_core_logs"
  ON public.drill_core_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can update drill_core_logs"
  ON public.drill_core_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Owner can delete drill_core_logs"
  ON public.drill_core_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_drill_core_logs_updated_at
  BEFORE UPDATE ON public.drill_core_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();