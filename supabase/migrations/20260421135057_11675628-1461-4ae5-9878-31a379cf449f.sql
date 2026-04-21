-- =========================================================
-- concession_patents: yearly patent payments per concession
-- =========================================================
CREATE TABLE public.concession_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_id uuid NOT NULL REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount_utm numeric NOT NULL DEFAULT 0,
  amount_clp numeric,
  amount_usd numeric,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  paid_at date,
  receipt_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(concession_id, year)
);
CREATE INDEX idx_concession_patents_project ON public.concession_patents(project_id);
CREATE INDEX idx_concession_patents_status ON public.concession_patents(status);
ALTER TABLE public.concession_patents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view concession_patents" ON public.concession_patents
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert concession_patents" ON public.concession_patents
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update concession_patents" ON public.concession_patents
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete concession_patents" ON public.concession_patents
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_concession_patents_updated
  BEFORE UPDATE ON public.concession_patents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- concession_overlaps: detected conflicts
-- =========================================================
CREATE TABLE public.concession_overlaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_id uuid NOT NULL REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  overlap_type text NOT NULL, -- third_party_concession | snaspe | indigenous_community | other
  overlap_with_id text,
  overlap_with_name text,
  area_overlap_ha numeric,
  pct_overlap numeric,
  severity text NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  geometry_geojson jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_concession_overlaps_project ON public.concession_overlaps(project_id);
CREATE INDEX idx_concession_overlaps_severity ON public.concession_overlaps(severity);
ALTER TABLE public.concession_overlaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view concession_overlaps" ON public.concession_overlaps
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert concession_overlaps" ON public.concession_overlaps
  FOR INSERT TO authenticated
  WITH CHECK (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Managers update concession_overlaps" ON public.concession_overlaps
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete concession_overlaps" ON public.concession_overlaps
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE TRIGGER trg_concession_overlaps_updated
  BEFORE UPDATE ON public.concession_overlaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- concession_history: SERNAGEOMIN sync snapshots
-- =========================================================
CREATE TABLE public.concession_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_id uuid NOT NULL REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  diff jsonb,
  source text NOT NULL DEFAULT 'sernageomin',
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_concession_history_concession ON public.concession_history(concession_id, synced_at DESC);
CREATE INDEX idx_concession_history_project ON public.concession_history(project_id);
ALTER TABLE public.concession_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view concession_history" ON public.concession_history
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

-- Inserts only by service role (no policy = blocked for authenticated; service_role bypasses RLS)

-- =========================================================
-- bulletin_watches: unified watch system (extends bulletin_watch_holders)
-- =========================================================
CREATE TABLE public.bulletin_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  watch_type text NOT NULL, -- holder | code | region | comuna | court_keyword | rut
  value text NOT NULL,
  label text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bulletin_watches_project ON public.bulletin_watches(project_id);
CREATE INDEX idx_bulletin_watches_type ON public.bulletin_watches(watch_type, value);
ALTER TABLE public.bulletin_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view bulletin_watches" ON public.bulletin_watches
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert bulletin_watches" ON public.bulletin_watches
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update bulletin_watches" ON public.bulletin_watches
  FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Managers delete bulletin_watches" ON public.bulletin_watches
  FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE TRIGGER trg_bulletin_watches_updated
  BEFORE UPDATE ON public.bulletin_watches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();