DROP POLICY IF EXISTS "Authenticated users can view data sources" ON public.data_sources;
CREATE POLICY "Creator or staff can view data sources" ON public.data_sources FOR SELECT TO authenticated
USING (auth.uid() = created_by OR public.is_platform_staff(auth.uid()));
DROP POLICY IF EXISTS mdir_select_authenticated ON public.mineral_deposits_ingest_runs;
CREATE POLICY mdir_select_creator_or_staff ON public.mineral_deposits_ingest_runs FOR SELECT TO authenticated
USING (auth.uid() = created_by OR public.is_platform_staff(auth.uid()) OR public.is_super_admin(auth.uid()));