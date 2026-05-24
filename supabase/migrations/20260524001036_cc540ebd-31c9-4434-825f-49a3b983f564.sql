
CREATE TABLE IF NOT EXISTS public.drill_hole_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_id uuid NOT NULL REFERENCES public.drill_holes(id) ON DELETE CASCADE,
  depth numeric NOT NULL CHECK (depth >= 0),
  azimuth numeric NOT NULL,
  dip numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hole_id, depth)
);
CREATE INDEX IF NOT EXISTS idx_drill_hole_surveys_hole ON public.drill_hole_surveys(hole_id, depth);

CREATE TABLE IF NOT EXISTS public.drill_hole_trajectories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_id uuid NOT NULL UNIQUE REFERENCES public.drill_holes(id) ON DELETE CASCADE,
  points jsonb NOT NULL,
  total_length numeric NOT NULL,
  engine_version text NOT NULL DEFAULT 'mining-engine@0.1.0',
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drill_hole_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_hole_trajectories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surveys_select" ON public.drill_hole_surveys FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_surveys.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))));
CREATE POLICY "surveys_write" ON public.drill_hole_surveys FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_surveys.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_surveys.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))));

CREATE POLICY "traj_select" ON public.drill_hole_trajectories FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_trajectories.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))));
CREATE POLICY "traj_write" ON public.drill_hole_trajectories FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_trajectories.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.drill_holes dh WHERE dh.id = drill_hole_trajectories.hole_id
  AND (dh.project_id IS NULL OR public.is_project_member(dh.project_id, auth.uid()))));
