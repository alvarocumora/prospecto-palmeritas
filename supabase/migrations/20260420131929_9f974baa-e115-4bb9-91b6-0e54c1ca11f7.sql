-- Extend mining_concessions with SERNAGEOMIN-style fields
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS rut_holder text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS datum text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mining_concessions_external_id
  ON public.mining_concessions(external_id) WHERE external_id IS NOT NULL;

-- ============================================================
-- mining_bulletins: publicaciones oficiales del Boletín Minero
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mining_bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'boletin_minero_cl',
  publication_number text,
  publication_date date,
  publication_type text NOT NULL DEFAULT 'pedimento', -- pedimento | mensura | manifestacion | otro
  holder_name text,
  holder_rut text,
  concession_name text,
  concession_code text,
  region text,
  provincia text,
  comuna text,
  area_ha numeric,
  centroid_lat numeric,
  centroid_lng numeric,
  geometry_geojson jsonb,
  source_url text,
  raw_payload jsonb,
  content_hash text NOT NULL UNIQUE,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mining_bulletins_date ON public.mining_bulletins(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_mining_bulletins_rut ON public.mining_bulletins(holder_rut) WHERE holder_rut IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mining_bulletins_centroid ON public.mining_bulletins(centroid_lat, centroid_lng);

ALTER TABLE public.mining_bulletins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view bulletins"
  ON public.mining_bulletins FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins insert bulletins"
  ON public.mining_bulletins FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update bulletins"
  ON public.mining_bulletins FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete bulletins"
  ON public.mining_bulletins FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_mining_bulletins_updated_at
  BEFORE UPDATE ON public.mining_bulletins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- bulletin_watch_holders: titulares vigilados por proyecto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bulletin_watch_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  holder_rut text,
  holder_name text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (holder_rut IS NOT NULL OR holder_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_bulletin_watch_holders_project ON public.bulletin_watch_holders(project_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_watch_holders_rut ON public.bulletin_watch_holders(holder_rut) WHERE holder_rut IS NOT NULL;

ALTER TABLE public.bulletin_watch_holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view watch holders"
  ON public.bulletin_watch_holders FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert watch holders"
  ON public.bulletin_watch_holders FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update watch holders"
  ON public.bulletin_watch_holders FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role]));

CREATE POLICY "Managers delete watch holders"
  ON public.bulletin_watch_holders FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role, 'project_manager'::project_role]));

CREATE TRIGGER update_bulletin_watch_holders_updated_at
  BEFORE UPDATE ON public.bulletin_watch_holders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- bulletin_alerts: alertas generadas por matching
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bulletin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bulletin_id uuid NOT NULL REFERENCES public.mining_bulletins(id) ON DELETE CASCADE,
  match_type text NOT NULL, -- 'aoi' | 'holder_rut' | 'holder_name'
  match_detail text,
  is_read boolean NOT NULL DEFAULT false,
  read_by uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, bulletin_id, match_type)
);

CREATE INDEX IF NOT EXISTS idx_bulletin_alerts_project ON public.bulletin_alerts(project_id, is_read, created_at DESC);

ALTER TABLE public.bulletin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view bulletin alerts"
  ON public.bulletin_alerts FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Members update own bulletin alerts"
  ON public.bulletin_alerts FOR UPDATE TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Super admins insert bulletin alerts"
  ON public.bulletin_alerts FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Admins delete bulletin alerts"
  ON public.bulletin_alerts FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role]));