DROP POLICY IF EXISTS "Members can view drill_core_logs" ON public.drill_core_logs;
DROP POLICY IF EXISTS "Editors can update drill_core_logs" ON public.drill_core_logs;
DROP POLICY IF EXISTS "Admins can delete drill_core_logs" ON public.drill_core_logs;

CREATE POLICY "Members can view drill_core_logs"
ON public.drill_core_logs FOR SELECT
USING (project_id IS NOT NULL AND is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can update drill_core_logs"
ON public.drill_core_logs FOR UPDATE
USING (project_id IS NOT NULL AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'geologist'::project_role]))
WITH CHECK (project_id IS NOT NULL AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'geologist'::project_role]));

CREATE POLICY "Admins can delete drill_core_logs"
ON public.drill_core_logs FOR DELETE
USING (project_id IS NOT NULL AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));