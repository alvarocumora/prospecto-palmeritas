
-- Enums
DO $$ BEGIN
  CREATE TYPE public.supplier_status AS ENUM ('nuevo','en_revision','documentos_incompletos','verificado','descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_country AS ENUM ('CL','PE','AR','BO','OTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_role AS ENUM ('titular','mandatario','intermediario','trader');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM ('borrador','enviada','en_revision','aprobada','descartada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rfq_status AS ENUM ('borrador','publicado','en_evaluacion','adjudicado','cerrado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending','review','approved','commercial','icpo','spa','shipment','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE DEFAULT ('SUP-' || to_char(now(),'YYMM') || '-' || substr(gen_random_uuid()::text,1,6)),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  country public.supplier_country NOT NULL DEFAULT 'CL',
  legal_name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_role TEXT,
  phone_e164 TEXT NOT NULL,
  email TEXT NOT NULL,
  supplier_role public.supplier_role NOT NULL,
  intermediaries_count TEXT,
  status public.supplier_status NOT NULL DEFAULT 'nuevo',
  discard_reason TEXT,
  invitation_token TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_owner_read" ON public.suppliers FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "suppliers_owner_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- SUPPLIER OFFERS
CREATE TABLE IF NOT EXISTS public.supplier_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  mine_name TEXT, region TEXT, concession_ref TEXT, concession_missing_reason TEXT,
  has_export_permit TEXT, chain_of_custody TEXT, material_availability TEXT,
  product TEXT NOT NULL, presentation TEXT,
  grade_value NUMERIC, grade_unit TEXT,
  tonnage_available_t NUMERIC, tonnage_monthly_t NUMERIC,
  port_or_delivery TEXT, incoterm TEXT, price_ask TEXT, price_basis TEXT,
  accepts_inspection TEXT NOT NULL, can_send_sample BOOLEAN,
  status public.offer_status NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supplier_offers TO authenticated;
GRANT ALL ON public.supplier_offers TO service_role;
ALTER TABLE public.supplier_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_access" ON public.supplier_offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (s.owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (s.owner_user_id = auth.uid() OR public.is_super_admin(auth.uid()))));

-- OFFER ELEMENTS
CREATE TABLE IF NOT EXISTS public.offer_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.supplier_offers(id) ON DELETE CASCADE,
  element TEXT NOT NULL, value NUMERIC, unit TEXT,
  source TEXT NOT NULL DEFAULT 'declarado',
  confidence NUMERIC,
  pending_confirmation BOOLEAN NOT NULL DEFAULT false,
  evidence_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_elements TO authenticated;
GRANT ALL ON public.offer_elements TO service_role;
ALTER TABLE public.offer_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elements_access" ON public.offer_elements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_offers o JOIN public.suppliers s ON s.id=o.supplier_id WHERE o.id=offer_id AND (s.owner_user_id=auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_offers o JOIN public.suppliers s ON s.id=o.supplier_id WHERE o.id=offer_id AND (s.owner_user_id=auth.uid() OR public.is_super_admin(auth.uid()))));

-- SUPPLIER DOCUMENTS
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.supplier_offers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, storage_path TEXT NOT NULL,
  file_hash TEXT, mime_type TEXT, size_bytes INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supplier_documents TO authenticated;
GRANT ALL ON public.supplier_documents TO service_role;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_access" ON public.supplier_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND (s.owner_user_id=auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND (s.owner_user_id=auth.uid() OR public.is_super_admin(auth.uid()))));

-- SUPPLIER EVENTS
CREATE TABLE IF NOT EXISTS public.supplier_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.supplier_events TO authenticated;
GRANT ALL ON public.supplier_events TO service_role;
ALTER TABLE public.supplier_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read" ON public.supplier_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND (s.owner_user_id=auth.uid() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "events_insert_staff" ON public.supplier_events FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- INVITATION LINKS
CREATE TABLE IF NOT EXISTS public.invitation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opens_count INTEGER NOT NULL DEFAULT 0,
  completions_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invitation_links TO authenticated;
GRANT ALL ON public.invitation_links TO service_role;
ALTER TABLE public.invitation_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links_staff" ON public.invitation_links FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- PUBLIC FORM HITS
CREATE TABLE IF NOT EXISTS public.public_form_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL, phone_hash TEXT, form_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_form_hits_ip ON public.public_form_hits (ip_hash, created_at DESC);
GRANT SELECT ON public.public_form_hits TO authenticated;
GRANT ALL ON public.public_form_hits TO service_role;
ALTER TABLE public.public_form_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hits_staff_read" ON public.public_form_hits FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- RFQs
CREATE TABLE IF NOT EXISTS public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref TEXT NOT NULL UNIQUE DEFAULT ('RFQ-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL, buyer_company TEXT,
  destination_country TEXT, destination_port TEXT,
  incoterm TEXT, currency TEXT NOT NULL DEFAULT 'USD',
  validity_date DATE, contract_duration_months INTEGER,
  notes TEXT,
  status public.rfq_status NOT NULL DEFAULT 'borrador',
  is_public BOOLEAN NOT NULL DEFAULT false,
  compliance_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfqs TO authenticated;
GRANT ALL ON public.rfqs TO service_role;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfqs_owner_or_staff" ON public.rfqs FOR ALL TO authenticated
  USING (created_by=auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (created_by=auth.uid() OR public.is_super_admin(auth.uid()));

-- RFQ PRODUCTS
CREATE TABLE IF NOT EXISTS public.rfq_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL, hs_code TEXT, purity TEXT, grade TEXT,
  qty_monthly_mt NUMERIC, qty_total_mt NUMERIC,
  preferred_origin TEXT, packaging TEXT,
  port_loading TEXT, port_destination TEXT,
  incoterm TEXT, target_price_usd NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_products TO authenticated;
GRANT ALL ON public.rfq_products TO service_role;
ALTER TABLE public.rfq_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_products_access" ON public.rfq_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id=rfq_id AND (r.created_by=auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id=rfq_id AND (r.created_by=auth.uid() OR public.is_super_admin(auth.uid()))));

-- RFQ APPLICATIONS
CREATE TABLE IF NOT EXISTS public.rfq_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'pending',
  application_score NUMERIC, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE ON public.rfq_applications TO authenticated;
GRANT ALL ON public.rfq_applications TO service_role;
ALTER TABLE public.rfq_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_access" ON public.rfq_applications FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND s.owner_user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id=rfq_id AND r.created_by=auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND s.owner_user_id=auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- SUPPLIER SCORES
CREATE TABLE IF NOT EXISTS public.supplier_scores (
  supplier_id UUID PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  mining_score NUMERIC, corporate_score NUMERIC, financial_score NUMERIC,
  esg_score NUMERIC, compliance_score NUMERIC,
  risk_score NUMERIC, risk_band TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplier_scores TO authenticated;
GRANT ALL ON public.supplier_scores TO service_role;
ALTER TABLE public.supplier_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_staff_read" ON public.supplier_scores FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- RISK ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES public.rfqs(id) ON DELETE SET NULL,
  summary TEXT, missing_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT, score NUMERIC, band TEXT,
  raw_output JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_staff" ON public.risk_assessments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- PRIVACY
CREATE TABLE IF NOT EXISTS public.privacy_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_md TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.privacy_policy_versions TO authenticated, anon;
GRANT ALL ON public.privacy_policy_versions TO service_role;
ALTER TABLE public.privacy_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_public_read" ON public.privacy_policy_versions FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE IF NOT EXISTS public.privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  ip_hash TEXT, user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.privacy_consents TO authenticated;
GRANT ALL ON public.privacy_consents TO service_role;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_read" ON public.privacy_consents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id=supplier_id AND s.owner_user_id=auth.uid()) OR public.is_super_admin(auth.uid()));

-- Trigger updated_at (usa función genérica si existe, si no crea)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at_v2() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN CREATE TRIGGER trg_sup_upd BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_v2(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_off_upd BEFORE UPDATE ON public.supplier_offers FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_v2(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_rfq_upd BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_v2(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_app_upd BEFORE UPDATE ON public.rfq_applications FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_v2(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Semilla política v1
INSERT INTO public.privacy_policy_versions (version, content_md)
VALUES ('2026-11-01', '# Politica de Privacidad — Geocapitals

Geocapitals recolecta datos personales de proveedores y compradores para gestionar procesos de comercio internacional de minerales, en cumplimiento con la Ley 21.719 de Chile.

## Finalidades
- Registrar y calificar proveedores.
- Gestionar requerimientos de compra (RFQ) y postulaciones.
- Emitir documentos comerciales y de cumplimiento.

## Conservacion
- Proveedores descartados: anonimizados a los 12 meses.
- Proveedores activos: mientras dure la relacion mas 5 años por obligacion tributaria.

## Derechos
Acceso, rectificacion, eliminacion y portabilidad desde /panel/mis-datos.

## Contacto
info@geocapitals.com')
ON CONFLICT (version) DO NOTHING;
