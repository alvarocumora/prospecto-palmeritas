
DROP POLICY IF EXISTS "Members can view drill_holes" ON public.drill_holes;
CREATE POLICY "Members can view drill_holes" ON public.drill_holes
  FOR SELECT USING (project_id IS NOT NULL AND is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view sampling_results" ON public.sampling_results;
CREATE POLICY "Members can view sampling_results" ON public.sampling_results
  FOR SELECT USING (project_id IS NOT NULL AND is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone views published listings" ON public.property_listings;
CREATE POLICY "Anyone views published listings" ON public.property_listings
  FOR SELECT USING (
    (is_published = true AND project_id IS NOT NULL)
    OR (owner_user_id = auth.uid() AND auth.uid() IS NOT NULL)
  );
