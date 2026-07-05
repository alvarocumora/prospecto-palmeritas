
CREATE OR REPLACE FUNCTION public.is_demo_public_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _project_id IN (
    '7a499b02-ecdf-447b-8956-b106fe4ec087'::uuid,
    'e5360f13-1647-4e44-bb13-c0614e6f39fe'::uuid,
    '8dc8e288-b22c-4bd4-9626-bb7fb85d1745'::uuid
  );
$$;

GRANT SELECT ON public.satellite_anomalies TO anon;
GRANT SELECT ON public.insar_displacement TO anon;
GRANT SELECT (id, code, name, description, commodity, country, region, center_lat, center_lng, status, cover_image_url, created_at, updated_at) ON public.projects TO anon;

DROP POLICY IF EXISTS "public_demo_read_satellite_anomalies" ON public.satellite_anomalies;
CREATE POLICY "public_demo_read_satellite_anomalies"
ON public.satellite_anomalies FOR SELECT TO anon
USING (public.is_demo_public_project(project_id));

DROP POLICY IF EXISTS "public_demo_read_insar_displacement" ON public.insar_displacement;
CREATE POLICY "public_demo_read_insar_displacement"
ON public.insar_displacement FOR SELECT TO anon
USING (public.is_demo_public_project(project_id));

DROP POLICY IF EXISTS "public_demo_read_projects" ON public.projects;
CREATE POLICY "public_demo_read_projects"
ON public.projects FOR SELECT TO anon
USING (public.is_demo_public_project(id));
