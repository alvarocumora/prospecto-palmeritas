-- 1. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drone-rasters',
  'drone-rasters',
  false,
  52428800, -- 50 MB
  ARRAY['image/tiff','image/png','image/jpeg','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for the bucket (path = {project_id}/{filename})
CREATE POLICY "Drone rasters: project members can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'drone-rasters'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Drone rasters: editors can insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drone-rasters'
  AND public.has_project_role(
    ((storage.foldername(name))[1])::uuid,
    auth.uid(),
    ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'geologist'::project_role]
  )
);

CREATE POLICY "Drone rasters: editors can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'drone-rasters'
  AND public.has_project_role(
    ((storage.foldername(name))[1])::uuid,
    auth.uid(),
    ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'geologist'::project_role]
  )
);

CREATE POLICY "Drone rasters: admins can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'drone-rasters'
  AND public.has_project_role(
    ((storage.foldername(name))[1])::uuid,
    auth.uid(),
    ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'geologist'::project_role]
  )
);

-- 3. Extra metadata columns on drone_rasters
ALTER TABLE public.drone_rasters
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS crs text,
  ADD COLUMN IF NOT EXISTS pixel_size_m numeric,
  ADD COLUMN IF NOT EXISTS width_px integer,
  ADD COLUMN IF NOT EXISTS height_px integer,
  ADD COLUMN IF NOT EXISTS band_count integer,
  ADD COLUMN IF NOT EXISTS min_value numeric,
  ADD COLUMN IF NOT EXISTS max_value numeric,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS processing boolean NOT NULL DEFAULT false;

-- 4. Index for storage_path lookups
CREATE INDEX IF NOT EXISTS idx_drone_rasters_storage_path
  ON public.drone_rasters (storage_path)
  WHERE storage_path IS NOT NULL;