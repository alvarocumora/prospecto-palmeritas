CREATE TABLE public.geochem_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sample_count INTEGER NOT NULL DEFAULT 0,
  elements_used TEXT[] NOT NULL DEFAULT '{}',
  pca_loadings JSONB NOT NULL DEFAULT '{}'::jsonb,
  pca_variance JSONB NOT NULL DEFAULT '{}'::jsonb,
  pca_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  clusters JSONB NOT NULL DEFAULT '[]'::jsonb,
  cluster_count INTEGER NOT NULL DEFAULT 0,
  pathfinder_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT,
  signature_confidence NUMERIC,
  notes TEXT
);

CREATE INDEX idx_geochem_analyses_project ON public.geochem_analyses(project_id, created_at DESC);

ALTER TABLE public.geochem_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view geochem analyses"
ON public.geochem_analyses FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Geologists insert geochem analyses"
ON public.geochem_analyses FOR INSERT TO authenticated
WITH CHECK (
  public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist','geologist']::project_role[])
  AND created_by = auth.uid()
);

CREATE POLICY "Geologists delete geochem analyses"
ON public.geochem_analyses FOR DELETE TO authenticated
USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist','geologist']::project_role[]));

CREATE POLICY "Geologists update geochem analyses"
ON public.geochem_analyses FOR UPDATE TO authenticated
USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist','geologist']::project_role[]));

CREATE TRIGGER trg_geochem_analyses_updated
BEFORE UPDATE ON public.geochem_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
