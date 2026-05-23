CREATE TABLE IF NOT EXISTS public.mag_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  mag_nt double precision NOT NULL,
  rank integer NOT NULL DEFAULT 0,
  radius_m double precision NOT NULL DEFAULT 500,
  source text NOT NULL DEFAULT 'EMAG2v3',
  bbox jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mag_targets_project ON public.mag_targets(project_id);
CREATE INDEX IF NOT EXISTS idx_mag_targets_rank ON public.mag_targets(project_id, rank);

ALTER TABLE public.mag_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mag_targets_select_members" ON public.mag_targets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = mag_targets.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "mag_targets_insert_members" ON public.mag_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = mag_targets.project_id
        AND (
          p.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "mag_targets_delete_owner_admin" ON public.mag_targets
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = mag_targets.project_id AND p.created_by = auth.uid())
  );