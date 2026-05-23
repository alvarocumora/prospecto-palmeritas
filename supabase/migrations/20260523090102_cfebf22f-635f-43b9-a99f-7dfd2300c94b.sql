
CREATE TABLE public.mag_target_revalidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bbox jsonb NOT NULL,
  grid_n integer NOT NULL,
  top_k integer NOT NULL,
  prev_count integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  added_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  moved_count integer NOT NULL DEFAULT 0,
  mag_changed_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  mean_shift_m double precision,
  max_shift_m double precision,
  mean_mag_delta_nt double precision,
  max_mag_delta_nt double precision,
  stats jsonb,
  prev_snapshot jsonb,
  new_snapshot jsonb,
  triggered_by text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mag_target_revalidations_project ON public.mag_target_revalidations(project_id, created_at DESC);

ALTER TABLE public.mag_target_revalidations ENABLE ROW LEVEL SECURITY;

CREATE POLICY mag_target_revalidations_select_members ON public.mag_target_revalidations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = mag_target_revalidations.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
  )
);

CREATE POLICY mag_target_revalidations_insert_members ON public.mag_target_revalidations
FOR INSERT WITH CHECK (true);

CREATE TABLE public.mag_target_revalidation_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revalidation_id uuid NOT NULL REFERENCES public.mag_target_revalidations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  change_type text NOT NULL,
  name text,
  prev_rank integer,
  new_rank integer,
  prev_lat double precision,
  prev_lon double precision,
  new_lat double precision,
  new_lon double precision,
  prev_mag_nt double precision,
  new_mag_nt double precision,
  shift_m double precision,
  mag_delta_nt double precision,
  rank_delta integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mag_revalidation_diffs_run ON public.mag_target_revalidation_diffs(revalidation_id);

ALTER TABLE public.mag_target_revalidation_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY mag_target_revalidation_diffs_select_members ON public.mag_target_revalidation_diffs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = mag_target_revalidation_diffs.project_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.app_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'::app_role)
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
  )
);

CREATE POLICY mag_target_revalidation_diffs_insert_members ON public.mag_target_revalidation_diffs
FOR INSERT WITH CHECK (true);
