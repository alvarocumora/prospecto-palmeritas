-- ============================================================
-- PJUD: Mining court cases + alerts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mining_court_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'pjud',
  case_number text,
  court text,
  jurisdiction text,
  matter text,
  plaintiff text,
  defendant text,
  defendant_rut text,
  comuna text,
  region text,
  filed_at date,
  last_movement_at date,
  status text,
  source_url text,
  raw_payload jsonb,
  content_hash text NOT NULL UNIQUE,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_cases_filed_at ON public.mining_court_cases (filed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_court_cases_defendant_rut ON public.mining_court_cases (defendant_rut);
CREATE INDEX IF NOT EXISTS idx_court_cases_defendant ON public.mining_court_cases (lower(defendant));

ALTER TABLE public.mining_court_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read court cases"
  ON public.mining_court_cases FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins insert court cases"
  ON public.mining_court_cases FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update court cases"
  ON public.mining_court_cases FOR UPDATE
  TO authenticated USING (public.is_super_admin(auth.uid()));

-- Alerts table

CREATE TABLE IF NOT EXISTS public.court_case_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.mining_court_cases(id) ON DELETE CASCADE,
  match_type text NOT NULL,
  match_detail text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  read_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, case_id, match_type)
);

CREATE INDEX IF NOT EXISTS idx_court_alerts_project ON public.court_case_alerts (project_id, created_at DESC);

ALTER TABLE public.court_case_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view court alerts"
  ON public.court_case_alerts FOR SELECT
  TO authenticated USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members update own court alerts"
  ON public.court_case_alerts FOR UPDATE
  TO authenticated USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Super admins insert court alerts"
  ON public.court_case_alerts FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins delete court alerts"
  ON public.court_case_alerts FOR DELETE
  TO authenticated USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

-- Touch updated_at
CREATE TRIGGER trg_court_cases_updated
  BEFORE UPDATE ON public.mining_court_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule daily PJUD scrape at 07:00 UTC (one hour after boletín)
SELECT cron.schedule(
  'sync-pjud-mining',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://prospecto-palmeritas.lovable.app/hooks/sync-pjud',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZmFidm5ibHJjcXVidmpyemt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTcwNDAsImV4cCI6MjA5MjA3MzA0MH0.rpD-tRDQ8LGMZLlTAGsxLo77ccx9SHOuXUA1qoWyjx4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
