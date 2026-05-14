DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'drill_holes','drill_core_logs','exploration_targets','satellite_anomalies','mining_concessions',
    'job_queue','satellite_jobs','cadastre_sync_runs',
    'deal_investor_pipeline','investor_interactions','data_room_access_grants',
    'concession_alerts','audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;