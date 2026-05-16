CREATE TABLE IF NOT EXISTS public.field_pois (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  poi_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  note TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  elevation_m DOUBLE PRECISION,
  photo_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_pois_project ON public.field_pois(project_id);
CREATE INDEX IF NOT EXISTS idx_field_pois_latlng ON public.field_pois(lat, lng);
CREATE INDEX IF NOT EXISTS idx_field_pois_created_by ON public.field_pois(created_by);

ALTER TABLE public.field_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view field POIs"
ON public.field_pois FOR SELECT
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can create field POIs"
ON public.field_pois FOR INSERT
WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Author or project owner can update field POIs"
ON public.field_pois FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Author or project owner can delete field POIs"
ON public.field_pois FOR DELETE
USING (
  created_by = auth.uid()
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER update_field_pois_updated_at
BEFORE UPDATE ON public.field_pois
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.field_pois;
ALTER TABLE public.field_pois REPLICA IDENTITY FULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('field-poi-photos', 'field-poi-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project members can read field POI photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'field-poi-photos'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Project members can upload field POI photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'field-poi-photos'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Owner can update field POI photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'field-poi-photos'
  AND owner = auth.uid()
);

CREATE POLICY "Owner or project owner can delete field POI photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'field-poi-photos'
  AND (
    owner = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_project_owner(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);