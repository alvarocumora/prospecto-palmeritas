-- HSE Permits
CREATE TABLE public.hse_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  permit_type text NOT NULL,
  authority text,
  number text,
  title text NOT NULL,
  issued_at date,
  expires_at date,
  status text NOT NULL DEFAULT 'active',
  document_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hse_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'low',
  category text NOT NULL,
  location text,
  description text NOT NULL,
  people_affected integer NOT NULL DEFAULT 0,
  corrective_actions text,
  status text NOT NULL DEFAULT 'open',
  reported_by uuid NOT NULL,
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  community_name text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  attendees integer,
  summary text NOT NULL,
  commitments text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hse_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hse_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_hse_permit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('active','expired','revoked','pending','renewed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.permit_type NOT IN ('environmental','water','exploration','community','safety','tailings','closure','other') THEN
    RAISE EXCEPTION 'Invalid permit_type: %', NEW.permit_type;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_hse_incident()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.severity NOT IN ('low','medium','high','critical','near_miss') THEN
    RAISE EXCEPTION 'Invalid severity: %', NEW.severity;
  END IF;
  IF NEW.status NOT IN ('open','investigating','closed','escalated') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.category NOT IN ('safety','environmental','equipment','vehicle','health','security','other') THEN
    RAISE EXCEPTION 'Invalid category: %', NEW.category;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_community_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.event_type NOT IN ('meeting','consultation','workshop','complaint','agreement','donation','training','other') THEN
    RAISE EXCEPTION 'Invalid event_type: %', NEW.event_type;
  END IF;
  IF NEW.status NOT IN ('planned','completed','cancelled','follow_up') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_hse_permit BEFORE INSERT OR UPDATE ON public.hse_permits FOR EACH ROW EXECUTE FUNCTION public.validate_hse_permit();
CREATE TRIGGER trg_validate_hse_incident BEFORE INSERT OR UPDATE ON public.hse_incidents FOR EACH ROW EXECUTE FUNCTION public.validate_hse_incident();
CREATE TRIGGER trg_validate_community_event BEFORE INSERT OR UPDATE ON public.community_events FOR EACH ROW EXECUTE FUNCTION public.validate_community_event();

CREATE TRIGGER trg_hse_permits_updated BEFORE UPDATE ON public.hse_permits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hse_incidents_updated BEFORE UPDATE ON public.hse_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_community_events_updated BEFORE UPDATE ON public.community_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies: hse_permits
CREATE POLICY "Members view hse_permits" ON public.hse_permits FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "HSE editors insert hse_permits" ON public.hse_permits FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role]) AND auth.uid() = created_by);
CREATE POLICY "HSE editors update hse_permits" ON public.hse_permits FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role]));
CREATE POLICY "Admins delete hse_permits" ON public.hse_permits FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

-- RLS Policies: hse_incidents
CREATE POLICY "Members view hse_incidents" ON public.hse_incidents FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "HSE editors insert hse_incidents" ON public.hse_incidents FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role,'field_technician'::project_role,'drilling_supervisor'::project_role]) AND auth.uid() = reported_by);
CREATE POLICY "HSE editors update hse_incidents" ON public.hse_incidents FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role]));
CREATE POLICY "Admins delete hse_incidents" ON public.hse_incidents FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

-- RLS Policies: community_events
CREATE POLICY "Members view community_events" ON public.community_events FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));
CREATE POLICY "Community editors insert community_events" ON public.community_events FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role,'community_relations'::project_role]) AND auth.uid() = created_by);
CREATE POLICY "Community editors update community_events" ON public.community_events FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role,'hse_officer'::project_role,'community_relations'::project_role]));
CREATE POLICY "Admins delete community_events" ON public.community_events FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

-- Indexes
CREATE INDEX idx_hse_permits_project ON public.hse_permits(project_id, expires_at);
CREATE INDEX idx_hse_incidents_project ON public.hse_incidents(project_id, occurred_at DESC);
CREATE INDEX idx_community_events_project ON public.community_events(project_id, event_date DESC);