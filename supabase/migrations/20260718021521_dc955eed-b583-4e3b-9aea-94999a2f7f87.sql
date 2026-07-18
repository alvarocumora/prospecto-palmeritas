
-- 1) concession_files UPDATE: require current editor role, not just uploader
DROP POLICY IF EXISTS "concession_files_update_restricted" ON public.concession_files;
CREATE POLICY "concession_files_update_restricted"
  ON public.concession_files
  FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role, 'chief_geologist'::project_role, 'geologist'::project_role])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role, 'chief_geologist'::project_role, 'geologist'::project_role])
  );

-- 2) Consolidate duplicate estudio-logos storage policies (keep single canonical set)
DROP POLICY IF EXISTS "estudio-logos: public read" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos read by path" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos owner write" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos owner update" ON storage.objects;
DROP POLICY IF EXISTS "estudio-logos owner delete" ON storage.objects;

CREATE POLICY "estudio-logos read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'estudio-logos');

CREATE POLICY "estudio-logos owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'estudio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "estudio-logos owner update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'estudio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "estudio-logos owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'estudio-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3) profiles: remove broad teammate PII exposure; teammates must use public.profiles_directory view
DROP POLICY IF EXISTS "Teammates view non-PII profile" ON public.profiles;

-- Preserve super-admin read via a scoped policy (was previously bundled with the teammate check)
CREATE POLICY "Super admins view all profiles"
  ON public.profiles
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Ensure the non-PII directory view is queryable by authenticated users
GRANT SELECT ON public.profiles_directory TO authenticated;
