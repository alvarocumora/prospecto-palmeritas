
-- Fix privilege escalation: use user_id instead of id
CREATE OR REPLACE FUNCTION public.is_geocapitals_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id AND p.account_type = 'geocapitals_team'
    )
$$;

-- Prevent clients from spoofing profile identity or self-promoting account_type
CREATE OR REPLACE FUNCTION public.enforce_profile_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean := public.is_super_admin(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Force user_id to auth.uid() for non-admins
    IF NOT is_admin THEN
      NEW.user_id := auth.uid();
      -- Prevent self-promotion; default to 'individual' if attempting privileged type
      IF NEW.account_type IS NOT NULL AND NEW.account_type IN ('geocapitals_team','super_admin') THEN
        NEW.account_type := 'individual';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT is_admin THEN
      NEW.user_id := OLD.user_id;
      NEW.account_type := OLD.account_type;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_safety ON public.profiles;
CREATE TRIGGER trg_enforce_profile_safety
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_safety();

-- Restrict null-project-id embeddings read to super_admin only
DROP POLICY IF EXISTS ai_emb_project_member_read ON public.ai_document_embeddings;
CREATE POLICY ai_emb_project_member_read ON public.ai_document_embeddings
FOR SELECT TO authenticated
USING (
  (project_id IS NULL AND public.is_super_admin(auth.uid()))
  OR public.is_project_member(project_id, auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- Restrict null-project-id job queue read to super_admin only
DROP POLICY IF EXISTS "members view jobs" ON public.job_queue;
CREATE POLICY "members view jobs" ON public.job_queue
FOR SELECT TO authenticated
USING (
  (project_id IS NULL AND public.is_super_admin(auth.uid()))
  OR public.is_project_member(project_id, auth.uid())
);
