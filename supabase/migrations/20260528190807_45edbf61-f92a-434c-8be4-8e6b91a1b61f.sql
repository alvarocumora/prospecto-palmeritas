
-- Caché de secciones IA del informe pre-NI 43-101
CREATE TABLE public.report_section_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL,
  data_hash text NOT NULL,
  payload jsonb NOT NULL,
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, section, data_hash)
);

CREATE INDEX idx_report_section_cache_project_section ON public.report_section_cache(project_id, section);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_section_cache TO authenticated;
GRANT ALL ON public.report_section_cache TO service_role;

ALTER TABLE public.report_section_cache ENABLE ROW LEVEL SECURITY;

-- Helper: usuario pertenece a la organización del proyecto
CREATE POLICY "Members can view report cache for their projects"
  ON public.report_section_cache FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = report_section_cache.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Members can write report cache for their projects"
  ON public.report_section_cache FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = report_section_cache.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Members can update report cache for their projects"
  ON public.report_section_cache FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = report_section_cache.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Members can delete report cache for their projects"
  ON public.report_section_cache FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = report_section_cache.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()
          )
        )
    )
  );

CREATE TRIGGER trg_report_section_cache_updated_at
  BEFORE UPDATE ON public.report_section_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para snapshots 3D y PDFs del informe
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can read report assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports');

CREATE POLICY "Authenticated users can upload report assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports');

CREATE POLICY "Authenticated users can update report assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reports');

CREATE POLICY "Authenticated users can delete report assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reports');
