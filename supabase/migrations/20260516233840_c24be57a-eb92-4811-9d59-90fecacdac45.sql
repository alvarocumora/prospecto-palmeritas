DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.satellite_analysis_runs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.satellite_anomalies;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.satellite_analysis_runs REPLICA IDENTITY FULL;
ALTER TABLE public.satellite_anomalies REPLICA IDENTITY FULL;