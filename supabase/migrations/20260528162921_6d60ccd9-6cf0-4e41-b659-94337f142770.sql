
CREATE TABLE public.engine_block_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  input_hash TEXT,
  settings_hash TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  resource_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  block_count INTEGER,
  binary_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_bmv_project ON public.engine_block_model_versions(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_block_model_versions TO authenticated;
GRANT ALL ON public.engine_block_model_versions TO service_role;
ALTER TABLE public.engine_block_model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_bmv_select" ON public.engine_block_model_versions FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_bmv_insert" ON public.engine_block_model_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_bmv_update" ON public.engine_block_model_versions FOR UPDATE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_bmv_delete" ON public.engine_block_model_versions FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TABLE public.engine_qaqc_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  critical_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_qaqc_project ON public.engine_qaqc_reports(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_qaqc_reports TO authenticated;
GRANT ALL ON public.engine_qaqc_reports TO service_role;
ALTER TABLE public.engine_qaqc_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_qaqc_select" ON public.engine_qaqc_reports FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_qaqc_write" ON public.engine_qaqc_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer']::project_role[]));
CREATE POLICY "engine_qaqc_update" ON public.engine_qaqc_reports FOR UPDATE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','qaqc_officer']::project_role[]));
CREATE POLICY "engine_qaqc_delete" ON public.engine_qaqc_reports FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TABLE public.engine_ai_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  block_model_version_id UUID REFERENCES public.engine_block_model_versions(id) ON DELETE SET NULL,
  summary TEXT,
  uncertainty NUMERIC,
  upside NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_ai_project ON public.engine_ai_interpretations(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_ai_interpretations TO authenticated;
GRANT ALL ON public.engine_ai_interpretations TO service_role;
ALTER TABLE public.engine_ai_interpretations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_ai_select" ON public.engine_ai_interpretations FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_ai_write" ON public.engine_ai_interpretations FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_ai_delete" ON public.engine_ai_interpretations FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TABLE public.engine_drill_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_code TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('A','B','C')),
  collar_x DOUBLE PRECISION NOT NULL,
  collar_y DOUBLE PRECISION NOT NULL,
  collar_z DOUBLE PRECISION,
  azimuth NUMERIC,
  dip NUMERIC,
  depth NUMERIC,
  confidence NUMERIC,
  estimated_cost NUMERIC,
  scenario TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','drilled')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_targets_project ON public.engine_drill_targets(project_id, priority, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_drill_targets TO authenticated;
GRANT ALL ON public.engine_drill_targets TO service_role;
ALTER TABLE public.engine_drill_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_targets_select" ON public.engine_drill_targets FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_targets_write" ON public.engine_drill_targets FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_targets_update" ON public.engine_drill_targets FOR UPDATE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_targets_delete" ON public.engine_drill_targets FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TABLE public.engine_reports_generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT,
  format TEXT NOT NULL DEFAULT 'json',
  payload JSONB,
  storage_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_reports_project ON public.engine_reports_generated(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_reports_generated TO authenticated;
GRANT ALL ON public.engine_reports_generated TO service_role;
ALTER TABLE public.engine_reports_generated ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_reports_select" ON public.engine_reports_generated FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_reports_write" ON public.engine_reports_generated FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[]));
CREATE POLICY "engine_reports_delete" ON public.engine_reports_generated FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TABLE public.engine_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_audit_project ON public.engine_audit_events(project_id, created_at DESC);
GRANT SELECT, INSERT ON public.engine_audit_events TO authenticated;
GRANT ALL ON public.engine_audit_events TO service_role;
ALTER TABLE public.engine_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_audit_select" ON public.engine_audit_events FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_audit_insert" ON public.engine_audit_events FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND actor_id = auth.uid());

CREATE TABLE public.engine_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('section','target','block_model_version','qaqc_issue','ai_interpretation','report')),
  entity_id TEXT NOT NULL,
  body TEXT NOT NULL,
  mentions UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved')),
  resolved_at TIMESTAMPTZ,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engine_comments_entity ON public.engine_comments(project_id, entity_type, entity_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_comments TO authenticated;
GRANT ALL ON public.engine_comments TO service_role;
ALTER TABLE public.engine_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engine_comments_select" ON public.engine_comments FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "engine_comments_insert" ON public.engine_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    AND author_id = auth.uid()
    AND public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer','external_consultant']::project_role[])
  );
CREATE POLICY "engine_comments_update_own" ON public.engine_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));
CREATE POLICY "engine_comments_delete_own" ON public.engine_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TRIGGER trg_engine_bmv_updated BEFORE UPDATE ON public.engine_block_model_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_engine_targets_updated BEFORE UPDATE ON public.engine_drill_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_engine_comments_updated BEFORE UPDATE ON public.engine_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('engine-artifacts', 'engine-artifacts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "engine_artifacts_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'engine-artifacts'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "engine_artifacts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'engine-artifacts'
    AND public.has_project_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
  );
CREATE POLICY "engine_artifacts_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'engine-artifacts'
    AND public.has_project_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
  );
