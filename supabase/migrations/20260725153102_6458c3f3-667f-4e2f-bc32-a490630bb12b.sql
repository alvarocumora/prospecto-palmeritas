
CREATE TYPE public.dsr_kind AS ENUM ('access','rectification','cancellation','opposition','portability');
CREATE TYPE public.dsr_status AS ENUM ('pending','in_review','fulfilled','rejected');

CREATE TABLE public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  kind public.dsr_kind NOT NULL,
  status public.dsr_status NOT NULL DEFAULT 'pending',
  details TEXT,
  response TEXT,
  handled_by UUID REFERENCES auth.users(id),
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_app_role(_user_id, 'super_admin'::app_role)
      OR public.has_app_role(_user_id, 'support'::app_role);
$$;

CREATE POLICY "Users read own DSR"
  ON public.data_subject_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

CREATE POLICY "Users create own DSR"
  ON public.data_subject_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff manage DSR"
  ON public.data_subject_requests FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE TRIGGER update_dsr_updated_at
  BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dsr_user ON public.data_subject_requests(user_id);
CREATE INDEX idx_dsr_status ON public.data_subject_requests(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.purge_privacy_retention()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_delivery_events WHERE created_at < now() - INTERVAL '180 days';
  DELETE FROM public.public_form_hits WHERE created_at < now() - INTERVAL '180 days';
  DELETE FROM public.audit_log WHERE created_at < now() - INTERVAL '365 days';
END;
$$;

REVOKE ALL ON FUNCTION public.purge_privacy_retention() FROM public, anon, authenticated;

SELECT cron.schedule(
  'privacy-retention-purge',
  '0 3 * * *',
  $$ SELECT public.purge_privacy_retention(); $$
);
