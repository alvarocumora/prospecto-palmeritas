
-- Helpers ya existentes esperados: public.has_role(uuid, app_role) y public.is_geocapitals_staff().
-- Todos los triggers son BEFORE UPDATE, SECURITY DEFINER, search_path=public.

-- ============ commodity_lots ============
CREATE OR REPLACE FUNCTION public.freeze_commodity_lot_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    NEW.is_verified := OLD.is_verified;
    NEW.verified_by := OLD.verified_by;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_commodity_lot_verification ON public.commodity_lots;
CREATE TRIGGER trg_freeze_commodity_lot_verification
BEFORE UPDATE ON public.commodity_lots
FOR EACH ROW EXECUTE FUNCTION public.freeze_commodity_lot_verification();

-- ============ investor_profiles ============
CREATE OR REPLACE FUNCTION public.freeze_investor_review_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_geocapitals_staff() THEN
    NEW.review_status    := OLD.review_status;
    NEW.reviewed_by      := OLD.reviewed_by;
    NEW.reviewed_at      := OLD.reviewed_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_investor_review_fields ON public.investor_profiles;
CREATE TRIGGER trg_freeze_investor_review_fields
BEFORE UPDATE ON public.investor_profiles
FOR EACH ROW EXECUTE FUNCTION public.freeze_investor_review_fields();

-- ============ profiles ============
CREATE OR REPLACE FUNCTION public.freeze_profile_account_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM OLD.account_type
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    NEW.account_type := OLD.account_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_profile_account_type ON public.profiles;
CREATE TRIGGER trg_freeze_profile_account_type
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.freeze_profile_account_type();

-- ============ qualified_persons ============
CREATE OR REPLACE FUNCTION public.freeze_qualified_person_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_verified_by  boolean;
  has_verified_at  boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    NEW.is_verified := OLD.is_verified;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='qualified_persons' AND column_name='verified_by'
    ) INTO has_verified_by;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='qualified_persons' AND column_name='verified_at'
    ) INTO has_verified_at;

    IF has_verified_by THEN
      NEW.verified_by := OLD.verified_by;
    END IF;
    IF has_verified_at THEN
      NEW.verified_at := OLD.verified_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_qualified_person_verification ON public.qualified_persons;
CREATE TRIGGER trg_freeze_qualified_person_verification
BEFORE UPDATE ON public.qualified_persons
FOR EACH ROW EXECUTE FUNCTION public.freeze_qualified_person_verification();
