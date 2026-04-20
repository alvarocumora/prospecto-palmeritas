-- Map annotations: collaborative pins with short comments
CREATE TABLE public.map_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  color text NOT NULL DEFAULT 'gold',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_map_annotations_project ON public.map_annotations(project_id);

ALTER TABLE public.map_annotations ENABLE ROW LEVEL SECURITY;

-- View: any project member
CREATE POLICY "Members view map_annotations"
  ON public.map_annotations FOR SELECT
  TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- Insert: any project member, must be author
CREATE POLICY "Members insert map_annotations"
  ON public.map_annotations FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(project_id, auth.uid()) AND auth.uid() = created_by);

-- Update: author OR admin/owner
CREATE POLICY "Authors or admins update map_annotations"
  ON public.map_annotations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
  );

-- Delete: author OR admin/owner
CREATE POLICY "Authors or admins delete map_annotations"
  ON public.map_annotations FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
  );

-- updated_at trigger
CREATE TRIGGER update_map_annotations_updated_at
  BEFORE UPDATE ON public.map_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.map_annotations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_annotations;