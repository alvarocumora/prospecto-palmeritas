
-- 1) Tabla focalizada de cambios de campo
CREATE TABLE IF NOT EXISTS public.concession_field_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_id UUID NOT NULL REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('holder','area_ha','status')),
  old_value TEXT,
  new_value TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccf_concession_changed
  ON public.concession_field_changes (concession_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccf_project_changed
  ON public.concession_field_changes (project_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccf_field
  ON public.concession_field_changes (field);

ALTER TABLE public.concession_field_changes ENABLE ROW LEVEL SECURITY;

-- RLS: solo miembros del proyecto (o super admin) pueden leer
CREATE POLICY "Project members can view concession changes"
  ON public.concession_field_changes
  FOR SELECT
  TO authenticated
  USING (
    public.is_project_member(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Insert: solo via trigger SECURITY DEFINER (no se permite INSERT directo desde clientes)
CREATE POLICY "No direct inserts"
  ON public.concession_field_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2) Trigger que registra cambios automáticamente
CREATE OR REPLACE FUNCTION public.trg_log_concession_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT;
  v_user UUID;
BEGIN
  -- Detecta la fuente: si last_synced_at cambió en este UPDATE, fue una sync.
  v_source := CASE
    WHEN NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at THEN COALESCE(NEW.source, 'sync')
    ELSE 'manual'
  END;
  v_user := auth.uid();

  IF NEW.holder IS DISTINCT FROM OLD.holder THEN
    INSERT INTO public.concession_field_changes
      (concession_id, project_id, field, old_value, new_value, source, changed_by)
    VALUES
      (NEW.id, NEW.project_id, 'holder',
       OLD.holder, NEW.holder, v_source, v_user);
  END IF;

  IF COALESCE(NEW.area_ha, -1) <> COALESCE(OLD.area_ha, -1) THEN
    INSERT INTO public.concession_field_changes
      (concession_id, project_id, field, old_value, new_value, source, changed_by)
    VALUES
      (NEW.id, NEW.project_id, 'area_ha',
       OLD.area_ha::text, NEW.area_ha::text, v_source, v_user);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.concession_field_changes
      (concession_id, project_id, field, old_value, new_value, source, changed_by)
    VALUES
      (NEW.id, NEW.project_id, 'status',
       OLD.status, NEW.status, v_source, v_user);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mining_concessions_field_changes ON public.mining_concessions;
CREATE TRIGGER trg_mining_concessions_field_changes
  AFTER UPDATE ON public.mining_concessions
  FOR EACH ROW
  WHEN (
    OLD.holder IS DISTINCT FROM NEW.holder
    OR COALESCE(OLD.area_ha, -1) <> COALESCE(NEW.area_ha, -1)
    OR OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.trg_log_concession_field_changes();

-- 3) Vista resumen: conteo total + por campo + último cambio por concesión
CREATE OR REPLACE VIEW public.concession_change_summary
WITH (security_invoker = on) AS
SELECT
  mc.id              AS concession_id,
  mc.project_id,
  mc.code,
  mc.name,
  COUNT(ccf.id)                                                 AS total_changes,
  COUNT(ccf.id) FILTER (WHERE ccf.field = 'holder')             AS holder_changes,
  COUNT(ccf.id) FILTER (WHERE ccf.field = 'area_ha')            AS area_changes,
  COUNT(ccf.id) FILTER (WHERE ccf.field = 'status')             AS status_changes,
  MAX(ccf.changed_at)                                           AS last_changed_at,
  MAX(mc.last_synced_at)                                        AS last_synced_at
FROM public.mining_concessions mc
LEFT JOIN public.concession_field_changes ccf
  ON ccf.concession_id = mc.id
GROUP BY mc.id, mc.project_id, mc.code, mc.name;

-- 4) Función para leer el historial de una concesión (respeta permisos)
CREATE OR REPLACE FUNCTION public.get_concession_change_history(_concession_id UUID, _limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  source TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id INTO v_project_id
  FROM public.mining_concessions WHERE id = _concession_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Concesión no encontrada';
  END IF;

  IF NOT public.is_project_member(v_project_id, auth.uid())
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acceso denegado al proyecto %', v_project_id;
  END IF;

  RETURN QUERY
  SELECT ccf.id, ccf.field, ccf.old_value, ccf.new_value,
         ccf.source, ccf.changed_by, ccf.changed_at
  FROM public.concession_field_changes ccf
  WHERE ccf.concession_id = _concession_id
  ORDER BY ccf.changed_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_concession_change_history(UUID, INTEGER) TO authenticated;

-- 5) Realtime para que el panel se refresque al recibir nuevas filas
ALTER TABLE public.concession_field_changes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.concession_field_changes;
