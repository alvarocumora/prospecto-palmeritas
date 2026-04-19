-- 1. Per-member capability flags
CREATE TABLE public.project_member_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  capability TEXT NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (project_id, user_id, capability)
);

ALTER TABLE public.project_member_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View capabilities (admins or self)"
  ON public.project_member_capabilities FOR SELECT TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]) OR auth.uid() = user_id);

CREATE POLICY "Admins insert capabilities"
  ON public.project_member_capabilities FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));

CREATE POLICY "Admins update capabilities"
  ON public.project_member_capabilities FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));

CREATE POLICY "Admins delete capabilities"
  ON public.project_member_capabilities FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));

-- 2. Approval workflow
ALTER TABLE public.drill_core_logs
  ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.sampling_results
  ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.validate_record_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.record_status NOT IN ('draft','review','approved','archived') THEN
    RAISE EXCEPTION 'Invalid record_status: %', NEW.record_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_drill_core_logs_status
  BEFORE INSERT OR UPDATE ON public.drill_core_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_record_status();

CREATE TRIGGER trg_validate_sampling_results_status
  BEFORE INSERT OR UPDATE ON public.sampling_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_record_status();

-- 3. QA/QC standards
CREATE TABLE public.qaqc_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  element TEXT NOT NULL,
  expected_value NUMERIC NOT NULL,
  tolerance_pct NUMERIC NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT 'g/t',
  certifying_lab TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code, element)
);

ALTER TABLE public.qaqc_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view qaqc_standards"
  ON public.qaqc_standards FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert qaqc_standards"
  ON public.qaqc_standards FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'geologist'::project_role,'qaqc_officer'::project_role]) AND auth.uid() = created_by);

CREATE POLICY "Editors update qaqc_standards"
  ON public.qaqc_standards FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'qaqc_officer'::project_role]));

CREATE POLICY "Admins delete qaqc_standards"
  ON public.qaqc_standards FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

CREATE TRIGGER trg_qaqc_standards_updated
  BEFORE UPDATE ON public.qaqc_standards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. QA/QC results
CREATE TABLE public.qaqc_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  sample_id UUID,
  sample_code TEXT NOT NULL,
  qc_type TEXT NOT NULL,
  element TEXT NOT NULL,
  measured_value NUMERIC,
  standard_id UUID,
  parent_sample_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  certificate TEXT,
  lab TEXT,
  measured_at DATE,
  notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qaqc_results_project ON public.qaqc_results(project_id);
CREATE INDEX idx_qaqc_results_standard ON public.qaqc_results(standard_id);

ALTER TABLE public.qaqc_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view qaqc_results"
  ON public.qaqc_results FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert qaqc_results"
  ON public.qaqc_results FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'geologist'::project_role,'qaqc_officer'::project_role]) AND auth.uid() = created_by);

CREATE POLICY "Editors update qaqc_results"
  ON public.qaqc_results FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'qaqc_officer'::project_role]));

CREATE POLICY "Admins delete qaqc_results"
  ON public.qaqc_results FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

CREATE TRIGGER trg_qaqc_results_updated
  BEFORE UPDATE ON public.qaqc_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();