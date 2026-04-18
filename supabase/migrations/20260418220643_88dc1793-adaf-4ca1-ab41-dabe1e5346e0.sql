-- =========================================================
-- Multi-tenant projects + membership + role-based RLS
-- =========================================================

-- 1) Profiles table (one row per auth user)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Project member role enum
CREATE TYPE public.project_role AS ENUM ('owner', 'admin', 'geologist', 'viewer');

-- 3) Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  commodity TEXT,
  country TEXT DEFAULT 'Chile',
  region TEXT,
  center_lat NUMERIC,
  center_lng NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  cover_image_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Project membership
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_project ON public.project_members(project_id);

-- 5) Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_role(_project_id UUID, _user_id UUID, _roles public.project_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  );
$$;

-- 6) RLS policies for projects
CREATE POLICY "Members can view their projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id, auth.uid()));

CREATE POLICY "Authenticated can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners/admins can update project"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_project_role(id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));

CREATE POLICY "Owners can delete project"
  ON public.projects FOR DELETE TO authenticated
  USING (public.has_project_role(id, auth.uid(), ARRAY['owner']::public.project_role[]));

-- Auto-add creator as owner member
CREATE OR REPLACE FUNCTION public.add_project_owner_member()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_project_owner_member
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.add_project_owner_member();

-- 7) RLS policies for project_members
CREATE POLICY "Members see their project rosters"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Owners/admins can add members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[])
    OR auth.uid() = user_id  -- allow self-insert from project_create trigger
  );

CREATE POLICY "Owners/admins can update member roles"
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));

CREATE POLICY "Owners/admins can remove members"
  ON public.project_members FOR DELETE TO authenticated
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));

-- 8) Add project_id to existing domain tables
ALTER TABLE public.geophysics_surveys     ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.geophysics_lines       ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.geophysics_stations    ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.drill_holes            ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.drill_core_logs        ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.sampling_results       ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.geological_features    ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.alteration_zones       ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.lithology_units        ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.mineralogy             ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.geo_references         ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX idx_surveys_project       ON public.geophysics_surveys(project_id);
CREATE INDEX idx_geo_lines_project     ON public.geophysics_lines(project_id);
CREATE INDEX idx_geo_stations_project  ON public.geophysics_stations(project_id);
CREATE INDEX idx_drill_holes_project   ON public.drill_holes(project_id);
CREATE INDEX idx_drill_logs_project    ON public.drill_core_logs(project_id);
CREATE INDEX idx_sampling_project      ON public.sampling_results(project_id);
CREATE INDEX idx_geofeat_project       ON public.geological_features(project_id);

-- 9) Drop old "created_by" RLS policies and replace with membership-based ones
-- We keep public SELECT for catalog tables (lithology, alteration, references, mineralogy, geophysics_surveys/lines/stations)
-- to preserve existing read flow, but writes now require project membership.

-- Helper macro pattern (repeat for each table)
DO $$
DECLARE
  t TEXT;
  required_role public.project_role[] := ARRAY['owner','admin','geologist']::public.project_role[];
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'geophysics_surveys','geophysics_lines','geophysics_stations',
    'drill_holes','drill_core_logs','sampling_results',
    'geological_features','alteration_zones','lithology_units','mineralogy','geo_references'
  ]) LOOP
    -- Drop existing per-user policies
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can insert own %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner can update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner can delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can view %1$s" ON public.%1$s', t);

    -- New membership-based write policies
    EXECUTE format($f$
      CREATE POLICY "Members can insert into %1$I"
        ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (
          project_id IS NOT NULL
          AND public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::public.project_role[])
          AND auth.uid() = created_by
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Editors can update %1$I"
        ON public.%1$I FOR UPDATE TO authenticated
        USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','geologist']::public.project_role[]));
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Admins can delete %1$I"
        ON public.%1$I FOR DELETE TO authenticated
        USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::public.project_role[]));
    $f$, t);
  END LOOP;
END $$;

-- 10) Restrict SELECT on sensitive operational tables to members only
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'drill_holes','drill_core_logs','sampling_results',
    'geophysics_surveys','geophysics_lines','geophysics_stations',
    'geological_features','alteration_zones','lithology_units','mineralogy','geo_references'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public can view %1$s" ON public.%1$s', t);
    EXECUTE format($f$
      CREATE POLICY "Members can view %1$I"
        ON public.%1$I FOR SELECT TO authenticated
        USING (
          project_id IS NULL  -- legacy demo rows still public to authenticated
          OR public.is_project_member(project_id, auth.uid())
        );
    $f$, t);
  END LOOP;
END $$;
