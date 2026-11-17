CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_platform_staff(_user_id)
    OR EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.investor_profiles WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.buyer_profiles WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND account_type IS NOT NULL)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_platform_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_user(uuid) TO authenticated, service_role;
DROP POLICY IF EXISTS "water_hydrology_read" ON public.water_hydrology;
CREATE POLICY "water_hydrology_read" ON public.water_hydrology FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can read compliance_rules" ON public.compliance_rules;
CREATE POLICY "Authenticated can read compliance_rules" ON public.compliance_rules FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "public_concessions_cache_authenticated_read" ON public.public_concessions_cache;
CREATE POLICY "public_concessions_cache_authenticated_read" ON public.public_concessions_cache FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "water_portfolios_read" ON public.water_portfolios;
CREATE POLICY "water_portfolios_read" ON public.water_portfolios FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "project_certifications_read_auth" ON public.project_certifications;
CREATE POLICY "project_certifications_read_auth" ON public.project_certifications FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "catastro_cache: authenticated read" ON public.catastro_cache;
CREATE POLICY "catastro_cache: authenticated read" ON public.catastro_cache FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "water_dd_auth_read" ON public.water_due_diligence;
CREATE POLICY "water_dd_auth_read" ON public.water_due_diligence FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "Certifications are public" ON public.commodity_certifications;
CREATE POLICY "Certifications are public" ON public.commodity_certifications FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "stage_timeline_read_auth" ON public.project_stage_timeline;
CREATE POLICY "stage_timeline_read_auth" ON public.project_stage_timeline FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "water_legal_auth_read" ON public.water_legal_records;
CREATE POLICY "water_legal_auth_read" ON public.water_legal_records FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "mineral_deposits_select_authenticated" ON public.mineral_deposits;
CREATE POLICY "mineral_deposits_select_authenticated" ON public.mineral_deposits FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "Anyone can read market comparables" ON public.market_comparables;
CREATE POLICY "Anyone can read market comparables" ON public.market_comparables FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "water_valuations_read" ON public.water_valuations;
CREATE POLICY "water_valuations_read" ON public.water_valuations FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "All authenticated read permissions" ON public.module_role_permissions;
CREATE POLICY "All authenticated read permissions" ON public.module_role_permissions FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "Anyone authenticated reads ni43101 catalogue" ON public.ni43101_section_catalogue;
CREATE POLICY "Anyone authenticated reads ni43101 catalogue" ON public.ni43101_section_catalogue FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "spv_entities_read_auth" ON public.spv_entities;
CREATE POLICY "spv_entities_read_auth" ON public.spv_entities FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "operation_document_structure_read" ON public.operation_document_structure;
CREATE POLICY "operation_document_structure_read" ON public.operation_document_structure FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "Public read of document registry" ON public.document_registry;
CREATE POLICY "Public read of document registry" ON public.document_registry FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "water_portfolio_assets_read" ON public.water_portfolio_assets;
CREATE POLICY "water_portfolio_assets_read" ON public.water_portfolio_assets FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "plan_entitlements_read" ON public.plan_entitlements;
CREATE POLICY "plan_entitlements_read" ON public.plan_entitlements FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));
DROP POLICY IF EXISTS "ops_metrics_read_auth" ON public.project_operations_metrics;
CREATE POLICY "ops_metrics_read_auth" ON public.project_operations_metrics FOR SELECT TO authenticated USING (public.is_platform_user(auth.uid()));