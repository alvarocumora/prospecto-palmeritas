
-- Targets Pipeline table
CREATE TABLE public.exploration_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  
  -- Identidad
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'vein',
  commodity TEXT,
  target_zone TEXT,
  
  -- Ubicación
  lat NUMERIC,
  lng NUMERIC,
  elevation_m NUMERIC,
  geometry_geojson JSONB,
  
  -- Pipeline Kanban
  stage TEXT NOT NULL DEFAULT 'generated',
  priority TEXT NOT NULL DEFAULT 'medium',
  score NUMERIC DEFAULT 50,
  confidence_pct NUMERIC,
  
  -- Justificación
  rationale TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  
  -- Operación
  assigned_to UUID,
  planned_meters NUMERIC,
  estimated_cost_usd NUMERIC,
  
  -- Workflow
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  closed_reason TEXT,
  closed_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, code)
);

CREATE INDEX idx_exploration_targets_project ON public.exploration_targets(project_id);
CREATE INDEX idx_exploration_targets_stage ON public.exploration_targets(stage);
CREATE INDEX idx_exploration_targets_priority ON public.exploration_targets(priority);

-- Validation trigger for stage and priority enums (use trigger, not check)
CREATE OR REPLACE FUNCTION public.validate_target_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage NOT IN ('generated','validated','drill_ready','drilling','drilled','closed') THEN
    RAISE EXCEPTION 'Invalid stage: %', NEW.stage;
  END IF;
  IF NEW.priority NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  IF NEW.target_type NOT IN ('vein','disseminated','skarn','porphyry','placer','epithermal','iocg','vms','other') THEN
    RAISE EXCEPTION 'Invalid target_type: %', NEW.target_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_exploration_targets
BEFORE INSERT OR UPDATE ON public.exploration_targets
FOR EACH ROW EXECUTE FUNCTION public.validate_target_workflow();

CREATE TRIGGER update_exploration_targets_updated_at
BEFORE UPDATE ON public.exploration_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.exploration_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view exploration_targets"
ON public.exploration_targets FOR SELECT TO authenticated
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert exploration_targets"
ON public.exploration_targets FOR INSERT TO authenticated
WITH CHECK (
  has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
  AND auth.uid() = created_by
);

CREATE POLICY "Editors update exploration_targets"
ON public.exploration_targets FOR UPDATE TO authenticated
USING (
  has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
);

CREATE POLICY "Admins delete exploration_targets"
ON public.exploration_targets FOR DELETE TO authenticated
USING (
  has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
);
