CREATE TABLE IF NOT EXISTS public.validation_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_snapshots_lookup
  ON public.validation_snapshots (project_id, table_name, created_at DESC);

ALTER TABLE public.validation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view validation_snapshots"
  ON public.validation_snapshots
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Members insert validation_snapshots"
  ON public.validation_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(project_id, auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Admins delete validation_snapshots"
  ON public.validation_snapshots
  FOR DELETE
  TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));