CREATE TABLE public.geology_wireframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  commodity TEXT,
  iso DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  smooth DOUBLE PRECISION NOT NULL DEFAULT 5,
  grid_n INTEGER NOT NULL DEFAULT 32,
  pad DOUBLE PRECISION NOT NULL DEFAULT 50,
  samples_used INTEGER,
  volume_m3 DOUBLE PRECISION,
  vertices JSONB NOT NULL,
  faces JSONB NOT NULL,
  bbox JSONB,
  origin_lng DOUBLE PRECISION,
  origin_lat DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geology_wireframes_project ON public.geology_wireframes(project_id);

ALTER TABLE public.geology_wireframes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wireframes_select_project_members"
  ON public.geology_wireframes FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "wireframes_insert_project_writers"
  ON public.geology_wireframes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "wireframes_update_owner_or_admin"
  ON public.geology_wireframes FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  );

CREATE POLICY "wireframes_delete_owner_or_admin"
  ON public.geology_wireframes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  );

CREATE TRIGGER trg_geology_wireframes_updated_at
  BEFORE UPDATE ON public.geology_wireframes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();