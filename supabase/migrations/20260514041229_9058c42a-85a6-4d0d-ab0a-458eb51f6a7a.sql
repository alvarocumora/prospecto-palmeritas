
-- 1) Settings table
CREATE TABLE IF NOT EXISTS public.concession_alert_settings (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  status_change_enabled boolean NOT NULL DEFAULT true,
  area_change_enabled boolean NOT NULL DEFAULT true,
  area_change_threshold_pct numeric NOT NULL DEFAULT 5 CHECK (area_change_threshold_pct >= 0 AND area_change_threshold_pct <= 100),
  holder_change_enabled boolean NOT NULL DEFAULT true,
  email_notify boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT '{}',
  webhook_url text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.concession_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view alert settings"
  ON public.concession_alert_settings FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Managers insert alert settings"
  ON public.concession_alert_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin','project_manager']::project_role[]) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Managers update alert settings"
  ON public.concession_alert_settings FOR UPDATE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(),
    ARRAY['owner','admin','project_manager']::project_role[]) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_alert_settings_touch
  BEFORE UPDATE ON public.concession_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Trigger function on concession_field_changes
CREATE OR REPLACE FUNCTION public.trg_concession_field_change_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.concession_alert_settings%ROWTYPE;
  c record;
  old_n numeric;
  new_n numeric;
  pct numeric;
  should_alert boolean := false;
  sev text := 'warning';
  title text;
  msg text;
  alert_id uuid;
  webhook_body jsonb;
  base_url text;
  auth_token text;
BEGIN
  -- Only react to sync-source changes
  IF NEW.source IS DISTINCT FROM 'sync' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.concession_alert_settings WHERE project_id = NEW.project_id;
  -- If no settings row, use defaults (enabled, 5%)
  IF NOT FOUND THEN
    s.status_change_enabled := true;
    s.area_change_enabled := true;
    s.holder_change_enabled := true;
    s.area_change_threshold_pct := 5;
    s.webhook_url := NULL;
  END IF;

  SELECT code, name, holder, status, area_ha INTO c
    FROM public.mining_concessions WHERE id = NEW.concession_id;
  IF c IS NULL THEN RETURN NEW; END IF;

  IF NEW.field = 'status' AND s.status_change_enabled THEN
    should_alert := true;
    sev := CASE WHEN lower(coalesce(NEW.new_value,'')) IN ('caducada','extinguida','rechazada')
                THEN 'critical' ELSE 'warning' END;
    title := 'Cambio de estado: ' || coalesce(c.code, c.name, 'concesión');
    msg := format('Estado pasó de "%s" a "%s"', coalesce(NEW.old_value,'—'), coalesce(NEW.new_value,'—'));

  ELSIF NEW.field = 'area_ha' AND s.area_change_enabled THEN
    BEGIN old_n := NULLIF(NEW.old_value,'')::numeric; EXCEPTION WHEN OTHERS THEN old_n := NULL; END;
    BEGIN new_n := NULLIF(NEW.new_value,'')::numeric; EXCEPTION WHEN OTHERS THEN new_n := NULL; END;
    IF old_n IS NOT NULL AND old_n > 0 AND new_n IS NOT NULL THEN
      pct := abs(new_n - old_n) / old_n * 100.0;
      IF pct >= s.area_change_threshold_pct THEN
        should_alert := true;
        sev := CASE WHEN pct >= s.area_change_threshold_pct * 2 THEN 'critical' ELSE 'warning' END;
        title := 'Variación de área: ' || coalesce(c.code, c.name, 'concesión');
        msg := format('Área cambió de %s ha a %s ha (%.2f%%)', old_n, new_n, pct);
      END IF;
    END IF;

  ELSIF NEW.field = 'holder' AND s.holder_change_enabled THEN
    should_alert := true;
    sev := 'warning';
    title := 'Cambio de titular: ' || coalesce(c.code, c.name, 'concesión');
    msg := format('Titular pasó de "%s" a "%s"', coalesce(NEW.old_value,'—'), coalesce(NEW.new_value,'—'));
  END IF;

  IF NOT should_alert THEN RETURN NEW; END IF;

  INSERT INTO public.concession_alerts (
    project_id, concession_id, alert_type, severity, title, message, payload
  ) VALUES (
    NEW.project_id, NEW.concession_id, 'concession_changed', sev, title, msg,
    jsonb_build_object(
      'field', NEW.field,
      'old_value', NEW.old_value,
      'new_value', NEW.new_value,
      'pct_change', pct,
      'source', NEW.source,
      'changed_at', NEW.changed_at,
      'code', c.code
    )
  ) RETURNING id INTO alert_id;

  -- Optional webhook dispatch
  IF s.webhook_url IS NOT NULL AND s.webhook_url <> '' THEN
    webhook_body := jsonb_build_object(
      'alert_id', alert_id,
      'project_id', NEW.project_id,
      'concession_id', NEW.concession_id,
      'code', c.code,
      'field', NEW.field,
      'old_value', NEW.old_value,
      'new_value', NEW.new_value,
      'severity', sev,
      'title', title,
      'message', msg,
      'created_at', now()
    );
    BEGIN
      PERFORM net.http_post(
        url := s.webhook_url,
        body := webhook_body,
        headers := '{"Content-Type":"application/json"}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never fail the trigger because of webhook problems
      NULL;
    END;
  END IF;

  -- Optional email dispatch via send-alert-email function
  IF s.email_notify AND array_length(s.email_recipients, 1) > 0 THEN
    SELECT value INTO base_url FROM public.system_config WHERE key = 'functions_base_url';
    SELECT value INTO auth_token FROM public.system_config WHERE key = 'functions_auth_bearer';
    IF base_url IS NOT NULL AND base_url <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := base_url || '/send-alert-email',
          body := jsonb_build_object(
            'alert_id', alert_id,
            'recipients', s.email_recipients,
            'title', title,
            'message', msg,
            'severity', sev,
            'project_id', NEW.project_id,
            'code', c.code
          ),
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer '||coalesce(auth_token,'')
          )
        );
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concession_field_change_alert ON public.concession_field_changes;
CREATE TRIGGER trg_concession_field_change_alert
  AFTER INSERT ON public.concession_field_changes
  FOR EACH ROW EXECUTE FUNCTION public.trg_concession_field_change_alert();
