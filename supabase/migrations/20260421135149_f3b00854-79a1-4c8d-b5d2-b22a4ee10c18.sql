-- =========================================================
-- qualified_persons: QP registry
-- =========================================================
CREATE TABLE public.qualified_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  profession text NOT NULL,
  registration_body text NOT NULL, -- AusIMM | CIM | SAIMM | SME | other
  license_no text NOT NULL,
  competency_areas text[] DEFAULT '{}',
  cv_url text,
  signature_url text,
  bio text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, registration_body, license_no)
);
ALTER TABLE public.qualified_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views qualified_persons" ON public.qualified_persons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own qualified_persons" ON public.qualified_persons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own qualified_persons" ON public.qualified_persons
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins delete qualified_persons" ON public.qualified_persons
  FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));

CREATE TRIGGER trg_qualified_persons_updated
  BEFORE UPDATE ON public.qualified_persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- technical_reports: NI 43-101 reports
-- =========================================================
CREATE TABLE public.technical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  effective_date date,
  signature_date date,
  report_type text NOT NULL DEFAULT 'ni43101', -- ni43101 | jorc | sk1300
  status text NOT NULL DEFAULT 'draft', -- draft | qp_review | approved | filed | archived
  lead_qp_id uuid REFERENCES public.qualified_persons(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  summary text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_technical_reports_project ON public.technical_reports(project_id);
ALTER TABLE public.technical_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view technical_reports" ON public.technical_reports
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert technical_reports" ON public.technical_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Editors update technical_reports" ON public.technical_reports
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist']::project_role[]));

CREATE POLICY "Admins delete technical_reports" ON public.technical_reports
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_technical_reports_updated
  BEFORE UPDATE ON public.technical_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- technical_report_sections: 27 sections per report
-- =========================================================
CREATE TABLE public.technical_report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_no integer NOT NULL,
  title text NOT NULL,
  content_md text DEFAULT '',
  status text NOT NULL DEFAULT 'empty', -- empty | draft | qp_review | approved
  qp_id uuid REFERENCES public.qualified_persons(id) ON DELETE SET NULL,
  signed_at timestamptz,
  signature_hash text,
  figures jsonb DEFAULT '[]'::jsonb,
  references_ids uuid[] DEFAULT '{}',
  word_count integer DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, section_no)
);
CREATE INDEX idx_technical_report_sections_report ON public.technical_report_sections(report_id);
ALTER TABLE public.technical_report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view technical_report_sections" ON public.technical_report_sections
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert technical_report_sections" ON public.technical_report_sections
  FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));

CREATE POLICY "Editors update technical_report_sections" ON public.technical_report_sections
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));

CREATE POLICY "Admins delete technical_report_sections" ON public.technical_report_sections
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_technical_report_sections_updated
  BEFORE UPDATE ON public.technical_report_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- technical_report_versions: immutable snapshots
-- =========================================================
CREATE TABLE public.technical_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  snapshot jsonb NOT NULL,
  hash_sha256 text NOT NULL,
  pdf_url text,
  watermark text DEFAULT 'DRAFT', -- DRAFT | FINAL | FILED
  generated_by uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, version_no)
);
CREATE INDEX idx_technical_report_versions_report ON public.technical_report_versions(report_id, version_no DESC);
ALTER TABLE public.technical_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view technical_report_versions" ON public.technical_report_versions
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert technical_report_versions" ON public.technical_report_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist']::project_role[])
    AND auth.uid() = generated_by
  );

-- =========================================================
-- Storage bucket: qp-signatures (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('qp-signatures', 'qp-signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read qp-signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qp-signatures');

CREATE POLICY "Users upload own qp-signatures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qp-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own qp-signatures" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'qp-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own qp-signatures" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'qp-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);