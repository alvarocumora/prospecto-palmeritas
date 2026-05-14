
DROP VIEW IF EXISTS public.v_satellite_run_traceability;

CREATE VIEW public.v_satellite_run_traceability
WITH (security_invoker = true)
AS
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
