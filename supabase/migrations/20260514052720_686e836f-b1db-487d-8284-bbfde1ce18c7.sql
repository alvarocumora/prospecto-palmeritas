
-- 1. Versioning + traceability columns on satellite_analysis_runs
ALTER TABLE public.satellite_analysis_runs
  ADD COLUMN IF NOT EXISTS version integer,
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES public.satellite_analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS pipeline_version text,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid;

CREATE INDEX IF NOT EXISTS idx_sat_runs_parent ON public.satellite_analysis_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_sat_runs_version ON public.satellite_analysis_runs(project_id, index_code, version DESC);
CREATE INDEX IF NOT EXISTS idx_sat_runs_content_hash ON public.satellite_analysis_runs(content_hash);

-- 2. Status events table (processing timeline)
CREATE TABLE IF NOT EXISTS public.satellite_run_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.satellite_analysis_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  message text,
  duration_ms bigint,
  actor_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sat_run_events_run ON public.satellite_run_status_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sat_run_events_project ON public.satellite_run_status_events(project_id, created_at DESC);

ALTER TABLE public.satellite_run_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sat_run_events_select" ON public.satellite_run_status_events;
CREATE POLICY "sat_run_events_select" ON public.satellite_run_status_events
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "sat_run_events_block_insert" ON public.satellite_run_status_events;
CREATE POLICY "sat_run_events_block_insert" ON public.satellite_run_status_events
  FOR INSERT TO authenticated WITH CHECK (false);

-- 3. Trigger: assign version, log status transitions, capture actor
CREATE OR REPLACE FUNCTION public.trg_satellite_run_versioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_dur bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version IS NULL THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
      FROM public.satellite_analysis_runs
      WHERE project_id = NEW.project_id AND index_code = NEW.index_code;
      NEW.version := v_next;
    END IF;
    NEW.last_modified_by := COALESCE(NEW.last_modified_by, auth.uid(), NEW.created_by);
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.last_modified_by := COALESCE(auth.uid(), OLD.last_modified_by);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_dur := CASE
      WHEN OLD.started_at IS NOT NULL AND NEW.status IN ('succeeded','failed','cancelled')
        THEN EXTRACT(EPOCH FROM (now() - OLD.started_at))::bigint * 1000
      ELSE NULL
    END;

    INSERT INTO public.satellite_run_status_events
      (run_id, project_id, from_status, to_status, message, duration_ms, actor_user_id, metadata)
    VALUES (
      NEW.id, NEW.project_id, OLD.status, NEW.status,
      NEW.error_message, v_dur, auth.uid(),
      jsonb_build_object(
        'pipeline_version', NEW.pipeline_version,
        'content_hash', NEW.content_hash,
        'storage_path', NEW.storage_path
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sat_run_versioning ON public.satellite_analysis_runs;
CREATE TRIGGER trg_sat_run_versioning
  BEFORE INSERT OR UPDATE ON public.satellite_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.trg_satellite_run_versioning();

-- 4. Backfill: version + initial status event for existing rows
WITH numbered AS (
  SELECT id,
    row_number() OVER (PARTITION BY project_id, index_code ORDER BY created_at) AS rn
  FROM public.satellite_analysis_runs
  WHERE version IS NULL
)
UPDATE public.satellite_analysis_runs r
SET version = n.rn,
    last_modified_by = COALESCE(r.last_modified_by, r.created_by)
FROM numbered n WHERE r.id = n.id;

INSERT INTO public.satellite_run_status_events (run_id, project_id, from_status, to_status, message, actor_user_id, created_at, metadata)
SELECT r.id, r.project_id, NULL, r.status, 'Backfill: estado inicial registrado', r.created_by, r.created_at,
       jsonb_build_object('backfill', true)
FROM public.satellite_analysis_runs r
WHERE NOT EXISTS (
  SELECT 1 FROM public.satellite_run_status_events e WHERE e.run_id = r.id
);

-- 5. Traceability view for the report
CREATE OR REPLACE VIEW public.v_satellite_run_traceability AS
SELECT
  r.id AS run_id,
  r.project_id,
  r.index_code,
  r.provider,
  r.sensor,
  r.version,
  r.parent_run_id,
  r.status,
  r.date_from,
  r.date_to,
  r.max_cloud_cover_pct,
  r.evalscript_version,
  r.pipeline_version,
  r.content_hash,
  r.storage_path,
  r.output_raster_url,
  r.source_metadata,
  r.parameters,
  r.created_by,
  r.last_modified_by,
  r.created_at,
  r.started_at,
  r.completed_at,
  r.updated_at,
  (SELECT count(*) FROM public.satellite_run_status_events e WHERE e.run_id = r.id) AS status_event_count,
  (SELECT jsonb_agg(jsonb_build_object(
            'from', from_status, 'to', to_status,
            'at', created_at, 'message', message,
            'duration_ms', duration_ms, 'actor', actor_user_id
          ) ORDER BY created_at)
     FROM public.satellite_run_status_events e WHERE e.run_id = r.id) AS status_timeline,
  (SELECT count(*) FROM public.audit_log a
     WHERE a.entity_type = 'satellite_analysis_runs' AND a.entity_id = r.id) AS audit_log_count
FROM public.satellite_analysis_runs r;

GRANT SELECT ON public.v_satellite_run_traceability TO authenticated;
