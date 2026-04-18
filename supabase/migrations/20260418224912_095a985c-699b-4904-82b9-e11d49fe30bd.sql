-- Mining concessions table for catastro module
CREATE TABLE public.mining_concessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  concession_type TEXT NOT NULL DEFAULT 'explotacion',
  status TEXT NOT NULL DEFAULT 'vigente',
  holder TEXT,
  area_ha NUMERIC,
  granted_at DATE,
  expires_at DATE,
  region TEXT,
  commune TEXT,
  geometry_geojson JSONB,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mining_concessions_project ON public.mining_concessions(project_id);
CREATE INDEX idx_mining_concessions_expires ON public.mining_concessions(expires_at);
CREATE INDEX idx_mining_concessions_code ON public.mining_concessions(code);

ALTER TABLE public.mining_concessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mining_concessions"
ON public.mining_concessions FOR SELECT
TO authenticated
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can insert into mining_concessions"
ON public.mining_concessions FOR INSERT
TO authenticated
WITH CHECK (
  project_id IS NOT NULL
  AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'geologist'::project_role])
  AND auth.uid() = created_by
);

CREATE POLICY "Editors can update mining_concessions"
ON public.mining_concessions FOR UPDATE
TO authenticated
USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'geologist'::project_role]));

CREATE POLICY "Admins can delete mining_concessions"
ON public.mining_concessions FOR DELETE
TO authenticated
USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));

CREATE TRIGGER update_mining_concessions_updated_at
BEFORE UPDATE ON public.mining_concessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();