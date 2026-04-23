-- Geophysics anomalies table
CREATE TABLE public.geophysics_anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES public.geophysics_surveys(id) ON DELETE CASCADE,
  station_id UUID REFERENCES public.geophysics_stations(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.exploration_targets(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  code TEXT NOT NULL,
  anomaly_type TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'detected',
  confidence_pct NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  peak_value NUMERIC,
  peak_unit TEXT,
  estimated_depth_m NUMERIC,
  estimated_area_m2 NUMERIC,
  rationale TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE,
  promoted_at TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_geophys_anom_survey ON public.geophysics_anomalies(survey_id);
CREATE INDEX idx_geophys_anom_project ON public.geophysics_anomalies(project_id);
CREATE INDEX idx_geophys_anom_status ON public.geophysics_anomalies(status);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_geophysics_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('detected','reviewed','validated','promoted','dismissed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.severity NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'Invalid severity: %', NEW.severity;
  END IF;
  IF NEW.confidence_pct IS NOT NULL AND (NEW.confidence_pct < 0 OR NEW.confidence_pct > 100) THEN
    RAISE EXCEPTION 'confidence_pct must be 0..100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_geophysics_anomaly
  BEFORE INSERT OR UPDATE ON public.geophysics_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.validate_geophysics_anomaly();

CREATE TRIGGER trg_geophysics_anomaly_updated
  BEFORE UPDATE ON public.geophysics_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.geophysics_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view geophys anomalies"
  ON public.geophysics_anomalies FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert geophys anomalies"
  ON public.geophysics_anomalies FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Project members can update geophys anomalies"
  ON public.geophysics_anomalies FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can delete geophys anomalies"
  ON public.geophysics_anomalies FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));