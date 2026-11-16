ALTER FUNCTION public.move_to_dlq(text,text,bigint,jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text,integer,integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text,jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text,bigint) SET search_path = public, pgmq;

ALTER POLICY "water_hydrology_read" ON public.water_hydrology TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated can read compliance_rules" ON public.compliance_rules TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "public_concessions_cache_authenticated_read" ON public.public_concessions_cache TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "water_portfolios_read" ON public.water_portfolios TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "project_certifications_read_auth" ON public.project_certifications TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "catastro_cache: authenticated read" ON public.catastro_cache TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "water_dd_auth_read" ON public.water_due_diligence TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Certifications are public" ON public.commodity_certifications TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "stage_timeline_read_auth" ON public.project_stage_timeline TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "water_legal_auth_read" ON public.water_legal_records TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can view data sources" ON public.data_sources TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "mineral_deposits_select_authenticated" ON public.mineral_deposits TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Anyone can read market comparables" ON public.market_comparables TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "mdir_select_authenticated" ON public.mineral_deposits_ingest_runs TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "water_valuations_read" ON public.water_valuations TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "All authenticated read permissions" ON public.module_role_permissions TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Anyone authenticated reads ni43101 catalogue" ON public.ni43101_section_catalogue TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "spv_entities_read_auth" ON public.spv_entities TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "operation_document_structure_read" ON public.operation_document_structure TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "Public read of document registry" ON public.document_registry TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "water_portfolio_assets_read" ON public.water_portfolio_assets TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "plan_entitlements_read" ON public.plan_entitlements TO authenticated USING (auth.uid() IS NOT NULL);
ALTER POLICY "ops_metrics_read_auth" ON public.project_operations_metrics TO authenticated USING (auth.uid() IS NOT NULL);

ALTER POLICY "anyone can submit contact" ON public.contact_messages WITH CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 320
  AND char_length(btrim(message)) BETWEEN 1 AND 5000
  AND char_length(role) <= 100 AND char_length(source) <= 100
  AND (organization IS NULL OR char_length(organization) <= 200)
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
);

ALTER POLICY "estudio-logos authenticated read" ON storage.objects USING (
  bucket_id = 'estudio-logos'
  AND (owner_id = (select auth.uid()::text) OR public.is_platform_staff(auth.uid()))
);