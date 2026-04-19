-- ============ CORE BOXES ============
CREATE TABLE public.core_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hole_id UUID REFERENCES public.drill_holes(id) ON DELETE SET NULL,
  box_code TEXT NOT NULL,
  box_number INTEGER,
  depth_from NUMERIC,
  depth_to NUMERIC,
  storage_location TEXT,
  rack TEXT,
  shelf TEXT,
  position TEXT,
  status TEXT NOT NULL DEFAULT 'stored',
  condition TEXT NOT NULL DEFAULT 'good',
  photo_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, box_code)
);

CREATE INDEX idx_core_boxes_project ON public.core_boxes(project_id);
CREATE INDEX idx_core_boxes_hole ON public.core_boxes(hole_id);
CREATE INDEX idx_core_boxes_status ON public.core_boxes(status);

ALTER TABLE public.core_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view core_boxes" ON public.core_boxes
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert core_boxes" ON public.core_boxes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','field_technician','drilling_supervisor']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Editors update core_boxes" ON public.core_boxes
  FOR UPDATE TO authenticated
  USING (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','field_technician','drilling_supervisor']::project_role[])
  );

CREATE POLICY "Admins delete core_boxes" ON public.core_boxes
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_core_boxes_updated
  BEFORE UPDATE ON public.core_boxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_core_box()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('stored','in_transit','sampled','archived','lost') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.condition NOT IN ('good','damaged','partial') THEN
    RAISE EXCEPTION 'Invalid condition: %', NEW.condition;
  END IF;
  IF NEW.depth_from IS NOT NULL AND NEW.depth_to IS NOT NULL AND NEW.depth_to < NEW.depth_from THEN
    RAISE EXCEPTION 'depth_to must be >= depth_from';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_core_box
  BEFORE INSERT OR UPDATE ON public.core_boxes
  FOR EACH ROW EXECUTE FUNCTION public.validate_core_box();

-- ============ SAMPLE CUSTODY ============
CREATE TABLE public.sample_custody (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sample_id UUID REFERENCES public.sampling_results(id) ON DELETE SET NULL,
  sample_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  from_user UUID,
  to_user UUID,
  carrier TEXT,
  waybill TEXT,
  seal_number TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sample_custody_project ON public.sample_custody(project_id);
CREATE INDEX idx_sample_custody_code ON public.sample_custody(sample_code);
CREATE INDEX idx_sample_custody_event ON public.sample_custody(event_type);

ALTER TABLE public.sample_custody ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sample_custody" ON public.sample_custody
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Editors insert sample_custody" ON public.sample_custody
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','field_technician','drilling_supervisor','qaqc_officer']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Admins update sample_custody" ON public.sample_custody
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','qaqc_officer']::project_role[]));

CREATE POLICY "Admins delete sample_custody" ON public.sample_custody
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE OR REPLACE FUNCTION public.validate_sample_custody()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.event_type NOT IN ('collected','packaged','shipped','received_lab','analyzed','returned','archived','rejected') THEN
    RAISE EXCEPTION 'Invalid event_type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sample_custody
  BEFORE INSERT OR UPDATE ON public.sample_custody
  FOR EACH ROW EXECUTE FUNCTION public.validate_sample_custody();