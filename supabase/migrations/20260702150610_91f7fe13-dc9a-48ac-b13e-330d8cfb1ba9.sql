DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "Project members can be inserted by owners" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_members;
DROP POLICY IF EXISTS "Users can join projects" ON public.project_members;
DROP POLICY IF EXISTS "project_members_self_insert" ON public.project_members;

CREATE POLICY "project_members_insert_by_admin"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_project_role(
      project_id,
      auth.uid(),
      ARRAY['owner','admin']::public.project_role[]
    )
  );
