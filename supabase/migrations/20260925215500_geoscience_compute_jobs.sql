-- Geoscience Compute Jobs v1
-- Universal reproducible execution envelope for numerical geoscience engines.

CREATE TABLE IF NOT EXISTS public.geoscience_compute_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'magnetic_inversion','gravity_inversion','ip_inversion','resistivity_inversion',
    'em_inversion','implicit_geological_model','vein_model','mantle_model',
    'variography','kriging'
  )),
  engine text NOT NULL CHECK (engine IN ('simpeg','gempy','pygimli','gstools','custom')),
  engine_version text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','queued','running','succeeded','failed','cancelled'
  )),
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geoscience_compute_jobs_project_type
  ON public.geoscience_compute_jobs(project_id, job_type);
CREATE INDEX IF NOT EXISTS idx_geoscience_compute_jobs_status
  ON public.geoscience_compute_jobs(project_id, status, created_at DESC);

ALTER TABLE public.geoscience_compute_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view geoscience compute jobs" ON public.geoscience_compute_jobs;
CREATE POLICY "Members view geoscience compute jobs"
  ON public.geoscience_compute_jobs FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage geoscience compute jobs" ON public.geoscience_compute_jobs;
CREATE POLICY "Members manage geoscience compute jobs"
  ON public.geoscience_compute_jobs FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

COMMENT ON TABLE public.geoscience_compute_jobs IS
  'Universal versioned compute envelope for geophysical inversion, implicit geological modelling and geostatistics. Inputs reference exact registry dataset versions/hashes.';
