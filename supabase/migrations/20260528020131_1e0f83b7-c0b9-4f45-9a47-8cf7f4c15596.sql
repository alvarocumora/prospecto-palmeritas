
-- 1) cadastre_national: restringir SELECT público (expone RUT). Solo autenticados.
DROP POLICY IF EXISTS cadastre_national_public_read ON public.cadastre_national;
CREATE POLICY cadastre_national_authenticated_read
  ON public.cadastre_national FOR SELECT TO authenticated
  USING (archived_at IS NULL);

-- 2) public_concessions_cache: restringir a autenticados.
DROP POLICY IF EXISTS "Public read concessions cache" ON public.public_concessions_cache;
CREATE POLICY public_concessions_cache_authenticated_read
  ON public.public_concessions_cache FOR SELECT TO authenticated
  USING (true);

-- 3) public_holders: restringir a autenticados.
DROP POLICY IF EXISTS "Public read holders" ON public.public_holders;
CREATE POLICY public_holders_authenticated_read
  ON public.public_holders FOR SELECT TO authenticated
  USING (true);

-- 4) mag_target_revalidations / diffs: el INSERT WITH CHECK true permitía anónimos. Exigir miembro de proyecto.
DROP POLICY IF EXISTS mag_target_revalidations_insert_members ON public.mag_target_revalidations;
CREATE POLICY mag_target_revalidations_insert_members
  ON public.mag_target_revalidations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = mag_target_revalidations.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS mag_target_revalidation_diffs_insert_members ON public.mag_target_revalidation_diffs;
CREATE POLICY mag_target_revalidation_diffs_insert_members
  ON public.mag_target_revalidation_diffs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = mag_target_revalidation_diffs.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

-- 5) Storage: holder-files INSERT debe verificar membresía del proyecto (por path prefix = project_id).
DROP POLICY IF EXISTS "Project members upload holder-files" ON storage.objects;
CREATE POLICY "Project members upload holder-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'holder-files'
    AND auth.uid() IS NOT NULL
    AND public.is_project_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- 6) Storage: pedimento-docs — eliminar políticas demasiado permisivas y restringir por membresía de proyecto.
-- Convención de path: primer segmento = project_id (uuid).
DROP POLICY IF EXISTS "Public read pedimento docs" ON storage.objects;
DROP POLICY IF EXISTS "pedimento_docs_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload pedimento docs" ON storage.objects;
DROP POLICY IF EXISTS "pedimento_docs_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update pedimento docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete pedimento docs" ON storage.objects;

CREATE POLICY "Project members read pedimento docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pedimento-docs'
    AND public.is_project_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project members upload pedimento docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pedimento-docs'
    AND public.is_project_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "Project managers update pedimento docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pedimento-docs'
    AND public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role]
    )
  );

CREATE POLICY "Project managers delete pedimento docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pedimento-docs'
    AND public.has_project_role(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role]
    )
  );
