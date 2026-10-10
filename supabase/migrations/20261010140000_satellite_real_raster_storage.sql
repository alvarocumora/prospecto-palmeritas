-- Private artifacts for the real Sentinel-2 processing pipeline.
-- No service-role bypass: users must be project members and write to their own path.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('satellite-products', 'satellite-products', false, 20000000, ARRAY['image/tiff'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Project members read satellite rasters" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'satellite-products' AND EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id::text = (storage.foldername(name))[1]
    AND public.is_project_member(p.id, auth.uid())
));
CREATE POLICY "Members write own satellite rasters" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'satellite-products'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND public.is_project_member(p.id, auth.uid())));
CREATE POLICY "Members remove own satellite rasters" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'satellite-products'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND public.is_project_member(p.id, auth.uid())));
