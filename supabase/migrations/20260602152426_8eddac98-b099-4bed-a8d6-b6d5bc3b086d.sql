
-- 1. data_room_access_grants: split policies — viewers must NOT manage grants
DROP POLICY IF EXISTS "Project members manage grants" ON public.data_room_access_grants;

CREATE POLICY "Project members view grants"
ON public.data_room_access_grants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.data_rooms r
    WHERE r.id = data_room_access_grants.data_room_id
      AND is_project_member(r.project_id, auth.uid())
  )
);

CREATE POLICY "Privileged members insert grants"
ON public.data_room_access_grants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.data_rooms r
    WHERE r.id = data_room_access_grants.data_room_id
      AND has_project_role(r.project_id, auth.uid(),
        ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
  )
);

CREATE POLICY "Privileged members update grants"
ON public.data_room_access_grants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.data_rooms r
    WHERE r.id = data_room_access_grants.data_room_id
      AND has_project_role(r.project_id, auth.uid(),
        ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.data_rooms r
    WHERE r.id = data_room_access_grants.data_room_id
      AND has_project_role(r.project_id, auth.uid(),
        ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
  )
);

CREATE POLICY "Privileged members delete grants"
ON public.data_room_access_grants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.data_rooms r
    WHERE r.id = data_room_access_grants.data_room_id
      AND has_project_role(r.project_id, auth.uid(),
        ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
  )
);

-- 2. Remove public-internet read of confidential geology/economics data
DROP POLICY IF EXISTS "veins_public_losverdes_read" ON public.veins;
DROP POLICY IF EXISTS "mpp_public_losverdes_read" ON public.mine_plan_phases;

-- 3. Remove highly sensitive tables from Realtime publication to prevent
-- broadcast of row changes via channel subscriptions.
ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime DROP TABLE public.data_room_access_grants;
ALTER PUBLICATION supabase_realtime DROP TABLE public.concession_field_changes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.satellite_evidence;
ALTER PUBLICATION supabase_realtime DROP TABLE public.insar_displacement;
