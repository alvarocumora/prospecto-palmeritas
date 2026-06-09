
DROP POLICY IF EXISTS "Authenticated read court cases" ON public.mining_court_cases;
CREATE POLICY "Super admins read court cases"
  ON public.mining_court_cases FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "mining_installations_read_authenticated" ON public.mining_installations;
CREATE POLICY "mining_installations_read_super_admin"
  ON public.mining_installations FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "pit_shells public read" ON public.pit_shells;
CREATE POLICY "pit_shells members read"
  ON public.pit_shells FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "synthetic_drillholes public read" ON public.synthetic_drillholes;
CREATE POLICY "synthetic_drillholes members read"
  ON public.synthetic_drillholes FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "synthetic_assays public read" ON public.synthetic_assays;
CREATE POLICY "synthetic_assays members read"
  ON public.synthetic_assays FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.synthetic_drillholes d
      WHERE d.id = synthetic_assays.hole_id
        AND (is_project_member(d.project_id, auth.uid()) OR is_super_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "synthetic_block_model public read" ON public.synthetic_block_model;
CREATE POLICY "synthetic_block_model members read"
  ON public.synthetic_block_model FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read report assets"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload report assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update report assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete report assets" ON storage.objects;

DROP POLICY IF EXISTS "reports_delete_project_members" ON storage.objects;
CREATE POLICY "reports_delete_project_members"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports'
    AND (
      is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
      OR is_super_admin(auth.uid())
    )
  );
