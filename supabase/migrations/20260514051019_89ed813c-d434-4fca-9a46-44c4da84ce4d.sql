CREATE TABLE IF NOT EXISTS public.insar_alert_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  insar_id uuid NOT NULL REFERENCES public.insar_displacement(id) ON DELETE CASCADE,
  follow_up_task_id uuid REFERENCES public.follow_up_tasks(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('task_created','recommendation','status_change','dismissed','escalated','field_inspection','closed')),
  severity_at_time text CHECK (severity_at_time IN ('info','warning','critical')),
  velocity_mm_year numeric,
  recommendation text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insar_actions_insar ON public.insar_alert_actions(insar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insar_actions_project ON public.insar_alert_actions(project_id, created_at DESC);

ALTER TABLE public.insar_alert_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insar_actions_select" ON public.insar_alert_actions
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "insar_actions_insert" ON public.insar_alert_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "insar_actions_delete" ON public.insar_alert_actions
  FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

ALTER PUBLICATION supabase_realtime ADD TABLE public.insar_alert_actions;