
-- ============================================================
-- 2.1 PROFILES: ampliar perfiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS country text;

-- ============================================================
-- 2.2 PROJECT INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.project_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | expired | revoked
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON public.project_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON public.project_invitations(token);

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins view their project invitations"
  ON public.project_invitations FOR SELECT
  TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE POLICY "Owners/admins create invitations"
  ON public.project_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
    AND auth.uid() = invited_by
  );

CREATE POLICY "Owners/admins revoke invitations"
  ON public.project_invitations FOR UPDATE
  TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

CREATE POLICY "Owners/admins delete invitations"
  ON public.project_invitations FOR DELETE
  TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

-- Function to preview an invitation by token (no auth required to read by token)
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  email text,
  role public.project_role,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.project_id, p.name AS project_name, i.email, i.role, i.status, i.expires_at
  FROM public.project_invitations i
  JOIN public.projects p ON p.id = i.project_id
  WHERE i.token = _token
  LIMIT 1;
$$;

-- Function to accept an invitation: adds user to project_members
CREATE OR REPLACE FUNCTION public.accept_project_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO inv FROM public.project_invitations WHERE token = _token LIMIT 1;
  IF inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_' || inv.status);
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, invited_by)
  VALUES (inv.project_id, uid, inv.role, inv.invited_by)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.project_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'project_id', inv.project_id);
END;
$$;

-- ============================================================
-- 2.3 AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  action text NOT NULL, -- INSERT | UPDATE | DELETE
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_project ON public.audit_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view project audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (project_id IS NULL OR public.is_project_member(project_id, auth.uid()));

-- Generic trigger function
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj uuid;
  ent uuid;
  payload_json jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    proj := (to_jsonb(OLD)->>'project_id')::uuid;
    ent := (to_jsonb(OLD)->>'id')::uuid;
    payload_json := to_jsonb(OLD);
  ELSE
    proj := (to_jsonb(NEW)->>'project_id')::uuid;
    ent := (to_jsonb(NEW)->>'id')::uuid;
    payload_json := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (project_id, user_id, action, entity_type, entity_id, payload)
  VALUES (proj, auth.uid(), TG_OP, TG_TABLE_NAME, ent, payload_json);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Apply triggers to key tables
DROP TRIGGER IF EXISTS audit_drill_holes ON public.drill_holes;
CREATE TRIGGER audit_drill_holes
  AFTER INSERT OR UPDATE OR DELETE ON public.drill_holes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

DROP TRIGGER IF EXISTS audit_drill_core_logs ON public.drill_core_logs;
CREATE TRIGGER audit_drill_core_logs
  AFTER INSERT OR UPDATE OR DELETE ON public.drill_core_logs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

DROP TRIGGER IF EXISTS audit_sampling_results ON public.sampling_results;
CREATE TRIGGER audit_sampling_results
  AFTER INSERT OR UPDATE OR DELETE ON public.sampling_results
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

DROP TRIGGER IF EXISTS audit_mining_concessions ON public.mining_concessions;
CREATE TRIGGER audit_mining_concessions
  AFTER INSERT OR UPDATE OR DELETE ON public.mining_concessions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- ============================================================
-- 3.4 SHARED LAYERS (marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shared_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text, -- e.g. geology | hydrography | structure | other
  geometry_geojson jsonb NOT NULL,
  tags text[] DEFAULT '{}',
  thumbnail_url text,
  is_public boolean NOT NULL DEFAULT true,
  owner_id uuid,
  downloads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view public layers"
  ON public.shared_layers FOR SELECT
  TO authenticated
  USING (is_public OR owner_id = auth.uid());

CREATE POLICY "Owners insert their layers"
  ON public.shared_layers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their layers"
  ON public.shared_layers FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete their layers"
  ON public.shared_layers FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_shared_layers_updated_at
  BEFORE UPDATE ON public.shared_layers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 3 example layers (owner_id NULL = system seed, public)
INSERT INTO public.shared_layers (name, description, category, geometry_geojson, tags, is_public, owner_id)
VALUES
  ('Falla Atacama (regional)',
   'Sistema de fallas Atacama, traza simplificada — Norte de Chile.',
   'structure',
   '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Falla Atacama"},"geometry":{"type":"LineString","coordinates":[[-70.4,-25.1],[-70.3,-26.0],[-70.2,-27.0],[-70.1,-28.0]]}}]}'::jsonb,
   ARRAY['chile','estructura','falla','regional'],
   true, NULL),
  ('Geología regional Norte Grande',
   'Polígonos simplificados de unidades geológicas del Norte Grande chileno.',
   'geology',
   '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"unit":"Jurásico volcánico"},"geometry":{"type":"Polygon","coordinates":[[[-70.5,-25.0],[-70.0,-25.0],[-70.0,-25.5],[-70.5,-25.5],[-70.5,-25.0]]]}}]}'::jsonb,
   ARRAY['chile','geología','jurásico'],
   true, NULL),
  ('Hidrografía Quebrada Paipote',
   'Trazas principales de quebradas en la cuenca Paipote.',
   'hydrography',
   '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Quebrada Paipote"},"geometry":{"type":"LineString","coordinates":[[-70.35,-27.35],[-70.30,-27.40],[-70.25,-27.42]]}}]}'::jsonb,
   ARRAY['chile','hidrografía','copiapó'],
   true, NULL)
ON CONFLICT DO NOTHING;
