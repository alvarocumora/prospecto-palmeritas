CREATE TABLE public.collateral_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  amount_clp bigint NOT NULL,
  months integer NOT NULL,
  project_pref text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.collateral_leads TO service_role;
GRANT SELECT, UPDATE ON public.collateral_leads TO authenticated;
ALTER TABLE public.collateral_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read collateral leads" ON public.collateral_leads
  FOR SELECT TO authenticated USING (public.is_geocapitals_staff(auth.uid()));
CREATE POLICY "Staff can update collateral leads" ON public.collateral_leads
  FOR UPDATE TO authenticated USING (public.is_geocapitals_staff(auth.uid()))
  WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.collateral_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key text NOT NULL CHECK (project_key IN ('hualane','valle-escondido')),
  doc_type text NOT NULL,
  title text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.collateral_documents TO service_role;
GRANT SELECT ON public.collateral_documents TO authenticated;
ALTER TABLE public.collateral_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read collateral documents" ON public.collateral_documents
  FOR SELECT TO authenticated USING (public.is_geocapitals_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.collateral_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER collateral_leads_touch BEFORE UPDATE ON public.collateral_leads
  FOR EACH ROW EXECUTE FUNCTION public.collateral_touch_updated_at();
CREATE TRIGGER collateral_documents_touch BEFORE UPDATE ON public.collateral_documents
  FOR EACH ROW EXECUTE FUNCTION public.collateral_touch_updated_at();