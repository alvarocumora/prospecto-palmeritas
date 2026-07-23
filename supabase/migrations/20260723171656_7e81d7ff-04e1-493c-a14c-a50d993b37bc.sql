
-- 1) email_delivery_events: quitar SELECT abierto a authenticated
DROP POLICY IF EXISTS "auth read delivery events" ON public.email_delivery_events;

-- 2) mag_targets: alinear DELETE con has_project_role owner/admin
DROP POLICY IF EXISTS mag_targets_delete_owner_admin ON public.mag_targets;
CREATE POLICY mag_targets_delete_owner_admin ON public.mag_targets
  FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
  );

-- 3) partner_invitations: eliminar SELECT público sin filtro (el server usa admin client)
DROP POLICY IF EXISTS "Public read by token" ON public.partner_invitations;

-- 4) profiles: bloquear auto-escalación de account_type a geocapitals_team
CREATE OR REPLACE FUNCTION public.prevent_privileged_account_type_self_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM COALESCE(OLD.account_type, NULL::account_type)
     AND NEW.account_type = 'geocapitals_team'::account_type
     AND NOT public.is_super_admin(auth.uid())
  THEN
    RAISE EXCEPTION 'No autorizado a asignar account_type privilegiado (geocapitals_team)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_privileged_account_type_ins ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_privileged_account_type_ins
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_account_type_self_assign();

DROP TRIGGER IF EXISTS trg_profiles_prevent_privileged_account_type_upd ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_privileged_account_type_upd
  BEFORE UPDATE OF account_type ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_account_type_self_assign();
