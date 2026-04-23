
-- ============================================================
-- Phase A: Catastro profesional — concession_alerts + triggers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.concession_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  concession_id uuid REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  holder_id uuid REFERENCES public.concession_holders(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  payload jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  read_by uuid,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concession_alerts_project_unread
  ON public.concession_alerts (project_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concession_alerts_concession
  ON public.concession_alerts (concession_id);
CREATE INDEX IF NOT EXISTS idx_concession_alerts_type
  ON public.concession_alerts (alert_type, severity);

ALTER TABLE public.concession_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view concession_alerts"
  ON public.concession_alerts FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members update concession_alerts"
  ON public.concession_alerts FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers delete concession_alerts"
  ON public.concession_alerts FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role]));

-- Allow service-role / member inserts (cron job and validated callers)
CREATE POLICY "Members insert concession_alerts"
  ON public.concession_alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER trg_concession_alerts_updated
  BEFORE UPDATE ON public.concession_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create alert when concession_history records a real diff
CREATE OR REPLACE FUNCTION public.trg_concession_history_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  diff_keys text[];
  alert_title text;
  alert_msg text;
  alert_severity text := 'warning';
BEGIN
  IF NEW.diff IS NULL OR NEW.diff = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  SELECT code, name INTO c FROM public.mining_concessions WHERE id = NEW.concession_id;
  IF c IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(key) INTO diff_keys FROM jsonb_object_keys(NEW.diff) AS key;

  alert_title := 'Cambio detectado en concesión ' || coalesce(c.code, '');
  alert_msg := 'Campos modificados: ' || array_to_string(diff_keys, ', ');

  IF 'status' = ANY(diff_keys) OR 'holder' = ANY(diff_keys) THEN
    alert_severity := 'critical';
  END IF;

  INSERT INTO public.concession_alerts (
    project_id, concession_id, alert_type, severity, title, message, payload
  ) VALUES (
    NEW.project_id, NEW.concession_id, 'concession_changed', alert_severity,
    alert_title, alert_msg, NEW.diff
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concession_history_alert ON public.concession_history;
CREATE TRIGGER trg_concession_history_alert
  AFTER INSERT ON public.concession_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_concession_history_alert();
