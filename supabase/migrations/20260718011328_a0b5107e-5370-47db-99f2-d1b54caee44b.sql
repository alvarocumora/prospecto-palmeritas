
-- Restrict cadastre_opportunities SELECT to Geocapitals staff / super admins
DROP POLICY IF EXISTS "Authenticated can read opportunities" ON public.cadastre_opportunities;

CREATE POLICY "Staff can read opportunities"
ON public.cadastre_opportunities
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_type = 'geocapitals_team'
  )
);

-- Harden mag_targets: require write project roles instead of any project member
DROP POLICY IF EXISTS "mag_targets_insert_members" ON public.mag_targets;
DROP POLICY IF EXISTS "mag_targets_select_members" ON public.mag_targets;

CREATE POLICY "mag_targets_select_privileged"
ON public.mag_targets
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(
    project_id, auth.uid(),
    ARRAY['owner','admin','project_manager','geologist','chief_geologist']::project_role[]
  )
);

CREATE POLICY "mag_targets_insert_privileged"
ON public.mag_targets
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(
    project_id, auth.uid(),
    ARRAY['owner','admin','project_manager','geologist','chief_geologist']::project_role[]
  )
);
