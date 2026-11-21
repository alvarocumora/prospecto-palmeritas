-- 1. Revoke direct client (PUBLIC, anon, authenticated) EXECUTE on 11 server-only / unused SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.get_trade_products(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_products(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_qualified_persons_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_qualified_persons_directory() TO service_role;

REVOKE ALL ON FUNCTION public.opportunities_geo(integer, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opportunities_geo(integer, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.search_cadastre(text, text, text, text, extensions.geometry, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_cadastre(text, text, text, text, extensions.geometry, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_trade_access_links(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_access_links(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_trade_public_price(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_public_price(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_public_express_report(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_express_report(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_trade_public_ficha(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_public_ficha(uuid) TO service_role;

ALTER FUNCTION public.operation_documents_checklist(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.operation_documents_checklist(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.operation_documents_checklist(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.spv_round_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spv_round_status(text) TO service_role;

REVOKE ALL ON FUNCTION public.franco_match_pertenencia(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.franco_match_pertenencia(jsonb, text) TO service_role;

-- 2. Convert 7 caller-scoped functions to SECURITY INVOKER and revoke PUBLIC/anon EXECUTE
ALTER FUNCTION public.get_trade_negotiation(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_trade_negotiation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_negotiation(uuid) TO authenticated, service_role;

ALTER FUNCTION public.get_trade_screenings(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_trade_screenings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trade_screenings(uuid) TO authenticated, service_role;

ALTER FUNCTION public.trade_documents_checklist(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.trade_documents_checklist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_documents_checklist(uuid) TO authenticated, service_role;

ALTER FUNCTION public.get_my_modules() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_my_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_modules() TO authenticated, service_role;

ALTER FUNCTION public.get_org_plan(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_org_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_plan(uuid) TO authenticated, service_role;

ALTER FUNCTION public.tenencia_overlaps(jsonb, uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.tenencia_overlaps(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenencia_overlaps(jsonb, uuid) TO authenticated, service_role;

ALTER FUNCTION public.deal_advance(uuid, text, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.deal_advance(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_advance(uuid, text, text) TO authenticated, service_role;

-- 3. Supporting RLS policies so SECURITY INVOKER functions preserve legitimate access
CREATE POLICY "Super admins view mining_concessions"
  ON public.mining_concessions
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "deal_stage_events_insert_parties"
  ON public.deal_stage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (
      public.is_platform_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.property_deal_inquiries i
        WHERE i.id = deal_stage_events.inquiry_id
          AND i.listing_id = deal_stage_events.listing_id
          AND i.inquirer_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.property_listings l
        WHERE l.id = deal_stage_events.listing_id
          AND l.owner_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "platform_staff_select_property_deal_inquiries"
  ON public.property_deal_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform_staff_update_property_deal_inquiries"
  ON public.property_deal_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform_staff_select_property_listings"
  ON public.property_listings
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));