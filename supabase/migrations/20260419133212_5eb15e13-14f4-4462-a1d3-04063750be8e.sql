CREATE TABLE public.prospectivity_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,
  cell_lat numeric NOT NULL,
  cell_lng numeric NOT NULL,
  cell_size_m numeric NOT NULL DEFAULT 100,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid
);

CREATE INDEX idx_prospectivity_cells_project_run ON public.prospectivity_cells(project_id, run_id);
CREATE INDEX idx_prospectivity_cells_score ON public.prospectivity_cells(project_id, score DESC);

ALTER TABLE public.prospectivity_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view prospectivity_cells"
ON public.prospectivity_cells FOR SELECT
TO authenticated
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Geologists insert prospectivity_cells"
ON public.prospectivity_cells FOR INSERT
TO authenticated
WITH CHECK (
  has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
  AND auth.uid() = generated_by
);

CREATE POLICY "Admins delete prospectivity_cells"
ON public.prospectivity_cells FOR DELETE
TO authenticated
USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[]));

CREATE TABLE public.prospectivity_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  bbox_geojson jsonb NOT NULL,
  cell_size_m numeric NOT NULL,
  cell_count integer NOT NULL DEFAULT 0,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX idx_prospectivity_runs_project ON public.prospectivity_runs(project_id, generated_at DESC);

ALTER TABLE public.prospectivity_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view prospectivity_runs"
ON public.prospectivity_runs FOR SELECT
TO authenticated
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Geologists insert prospectivity_runs"
ON public.prospectivity_runs FOR INSERT
TO authenticated
WITH CHECK (
  has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
  AND auth.uid() = generated_by
);

CREATE POLICY "Admins delete prospectivity_runs"
ON public.prospectivity_runs FOR DELETE
TO authenticated
USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[]));