
-- Global app role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE POLICY "Super-admins read app_roles"
  ON public.app_roles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super-admins insert app_roles"
  ON public.app_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super-admins delete app_roles"
  ON public.app_roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Seed: Álvaro as super_admin
INSERT INTO public.app_roles (user_id, role, granted_by)
VALUES ('0d7f051a-93a1-4290-9e2e-5266913dd52d', 'super_admin', '0d7f051a-93a1-4290-9e2e-5266913dd52d')
ON CONFLICT (user_id, role) DO NOTHING;

-- Allow super-admins to read all profiles (already permissive but keep explicit)
-- Allow super-admins to read all projects (override)
CREATE POLICY "Super-admins view all projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super-admins view all members"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
