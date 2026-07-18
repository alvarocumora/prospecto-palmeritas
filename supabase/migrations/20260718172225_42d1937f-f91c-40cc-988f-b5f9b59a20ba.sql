
-- 1) advance_requests: prevent requester from mutating financial/decision fields
CREATE OR REPLACE FUNCTION public.advance_requests_guard_requester_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.requester_user_id = auth.uid() THEN
    IF NEW.risk_score IS DISTINCT FROM OLD.risk_score
       OR NEW.indicative_fee_pct IS DISTINCT FROM OLD.indicative_fee_pct
       OR NEW.max_advance_usd IS DISTINCT FROM OLD.max_advance_usd
       OR NEW.advance_rate_pct IS DISTINCT FROM OLD.advance_rate_pct
       OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
       OR NEW.decision_notes IS DISTINCT FROM OLD.decision_notes
       OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
       OR NEW.eligibility IS DISTINCT FROM OLD.eligibility
       OR NEW.offer_snapshot IS DISTINCT FROM OLD.offer_snapshot
       OR NEW.lot_value_usd IS DISTINCT FROM OLD.lot_value_usd
       OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
    THEN
      RAISE EXCEPTION 'Requesters cannot modify financial or decision fields on advance_requests';
    END IF;
    -- Requester may only move status to 'cancelled'
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Requesters can only cancel their advance request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advance_requests_guard_requester ON public.advance_requests;
CREATE TRIGGER advance_requests_guard_requester
BEFORE UPDATE ON public.advance_requests
FOR EACH ROW EXECUTE FUNCTION public.advance_requests_guard_requester_fields();

-- 2) commodity_lots: prevent sellers from self-verifying
CREATE OR REPLACE FUNCTION public.commodity_lots_guard_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_app_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
  THEN
    RAISE EXCEPTION 'Only admins can change verification fields on commodity_lots';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commodity_lots_guard_verification ON public.commodity_lots;
CREATE TRIGGER commodity_lots_guard_verification
BEFORE UPDATE ON public.commodity_lots
FOR EACH ROW EXECUTE FUNCTION public.commodity_lots_guard_verification();

-- 3) property_listings: prevent owner from self-granting paid features
CREATE OR REPLACE FUNCTION public.property_listings_guard_monetization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.featured_until IS DISTINCT FROM OLD.featured_until
     OR NEW.listing_paid_until IS DISTINCT FROM OLD.listing_paid_until
     OR NEW.required_plan IS DISTINCT FROM OLD.required_plan
  THEN
    RAISE EXCEPTION 'Only admins can change monetization fields on property_listings';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_listings_guard_monetization ON public.property_listings;
CREATE TRIGGER property_listings_guard_monetization
BEFORE UPDATE ON public.property_listings
FOR EACH ROW EXECUTE FUNCTION public.property_listings_guard_monetization();

-- 4) Public records PII: restrict blanket authenticated SELECT to super_admins.
-- These tables carry Chilean RUT/holder_name PII for third parties. Public
-- read via mining_bulletins/patent_remates/public_holders is downgraded to
-- admin-only; public surfaces must go through curated views or edge functions.
DROP POLICY IF EXISTS "Authenticated users view bulletins" ON public.mining_bulletins;
CREATE POLICY "Super admins view bulletins"
ON public.mining_bulletins
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users view remates" ON public.patent_remates;
CREATE POLICY "Super admins view remates"
ON public.patent_remates
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "public_holders_authenticated_read" ON public.public_holders;
CREATE POLICY "public_holders_super_admin_read"
ON public.public_holders
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
