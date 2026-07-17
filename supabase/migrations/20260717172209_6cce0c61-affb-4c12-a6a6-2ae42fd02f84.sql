
CREATE OR REPLACE FUNCTION public.prevent_account_type_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM OLD.account_type
     AND NEW.account_type = 'geocapitals_team'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only super admins can grant geocapitals_team access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_account_type_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_account_type_escalation
  BEFORE UPDATE OF account_type ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_account_type_self_escalation();
