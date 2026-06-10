CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  organization text CHECK (char_length(organization) <= 200),
  role text NOT NULL CHECK (role IN ('owner','investor','qp','other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  source text NOT NULL DEFAULT 'landing',
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','answered','spam')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit contact" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "super_admin reads contact" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_roles ar
    WHERE ar.user_id = auth.uid() AND ar.role::text = 'super_admin'
  ));

CREATE POLICY "super_admin updates contact" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.app_roles ar
    WHERE ar.user_id = auth.uid() AND ar.role::text = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.app_roles ar
    WHERE ar.user_id = auth.uid() AND ar.role::text = 'super_admin'
  ));

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON public.contact_messages (status);